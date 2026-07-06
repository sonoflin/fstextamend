/* =========================================================================
   Data access: City of Mesa ArcGIS REST services, fetched client-side.

   Zoning polygons and council districts are loaded directly from the City's
   public GIS servers so the map always reflects current data. Several
   candidate endpoints are tried in order; each is validated against its
   layer metadata before use.
   ========================================================================= */

// Verified live City of Mesa ArcGIS REST endpoints (checked against their
// public layer metadata). The first entry in each list is the current
// working service; the rest are kept as fallbacks in case a layer id or
// service name changes.
const ZONING_CANDIDATES = [
  'https://gis.mesaaz.gov/mesaaz/rest/services/Planning/ZoningOverlay/MapServer/1',
  'https://gis.mesaaz.gov/s_mesaaz/rest/services/Planning/ZoningOverlay/MapServer/1',
  'https://gis.mesaaz.gov/mesaaz/rest/services/Planning/PlanningLayers/MapServer/2',
  'https://gis.mesaaz.gov/mesaaz/rest/services/Accela/Accela_Base/MapServer/33',
];

const COUNCIL_CANDIDATES = [
  'https://gis.mesaaz.gov/mesaaz/rest/services/BaseMap/MesaDistricts/MapServer/2',
  'https://gis.mesaaz.gov/mesaaz/rest/services/Accela/Accela_Boundaries/MapServer/1',
  'https://maps.mesaaz.gov/server/rest/services/Transportation/Council_District/MapServer/0',
];

// Bundled snapshot of the same Mesa GIS layers, served from this site's own
// origin. Used as a fallback when the live GIS service is unreachable — e.g.
// on networks that block outbound access to gis.mesaaz.gov. Regenerate with
// tools/build-snapshot.mjs.
const SNAPSHOT_ZONING = 'data/zoning.geojson';
const SNAPSHOT_COUNCIL = 'data/council.geojson';

const FETCH_TIMEOUT_MS = 25000;
// The initial reachability probe of each live endpoint uses a shorter timeout
// so restricted networks fall back to the snapshot quickly instead of hanging.
const PROBE_TIMEOUT_MS = 9000;
const CHUNK_SIZE = 700;
const CONCURRENCY = 4;

function timeoutFetch(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(t));
}

async function getJSON(url, params, timeoutMs) {
  const body = new URLSearchParams({ f: 'json', ...params });
  // POST keeps long objectIds lists off the URL.
  const res = await timeoutFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const json = await res.json();
  if (json.error) throw new Error(`ArcGIS error ${json.error.code || ''}: ${json.error.message || 'unknown'}`);
  return json;
}

/* ---- Esri JSON -> GeoJSON fallback (when f=geojson is unsupported) ---- */

function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function pointInRing(pt, ring) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function esriPolygonToGeoJSON(rings) {
  // Esri: exterior rings are clockwise (negative signed area in lon/lat),
  // holes counter-clockwise.
  const outers = [];
  const holes = [];
  for (const ring of rings) {
    if (ring.length < 4) continue;
    (ringArea(ring) < 0 ? outers : holes).push(ring);
  }
  if (!outers.length) return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  const polys = outers.map((o) => [o]);
  for (const hole of holes) {
    const host = polys.find((p) => pointInRing(hole[0], p[0]));
    (host || polys[0]).push(hole);
  }
  return polys.length === 1
    ? { type: 'Polygon', coordinates: polys[0] }
    : { type: 'MultiPolygon', coordinates: polys };
}

function esriToGeoJSON(esri) {
  return {
    type: 'FeatureCollection',
    features: (esri.features || [])
      .map((f) => ({
        type: 'Feature',
        properties: f.attributes || {},
        geometry: f.geometry && f.geometry.rings ? esriPolygonToGeoJSON(f.geometry.rings) : null,
      }))
      .filter((f) => f.geometry),
  };
}

/* ---- Layer discovery ---- */

async function inspectLayer(url) {
  const meta = await getJSON(url, {}, PROBE_TIMEOUT_MS);
  if (meta.type && meta.type !== 'Feature Layer') throw new Error(`${url}: not a feature layer`);
  if (meta.geometryType !== 'esriGeometryPolygon') throw new Error(`${url}: not polygons`);
  return meta;
}

function findField(meta, patterns, types) {
  const fields = meta.fields || [];
  for (const pat of patterns) {
    const hit = fields.find(
      (f) => pat.test(f.name) && (!types || types.includes(f.type))
    );
    if (hit) return hit.name;
  }
  return null;
}

/* ---- Feature download: ids first, then chunked queries ---- */

async function fetchAllFeatures(url, meta, outFields, onProgress) {
  const oidField =
    meta.objectIdField ||
    findField(meta, [/^objectid$/i, /^fid$/i, /objectid/i], ['esriFieldTypeOID']) ||
    'OBJECTID';

  const idResp = await getJSON(`${url}/query`, {
    where: '1=1',
    returnIdsOnly: 'true',
  });
  const ids = idResp.objectIds || [];
  if (!ids.length) throw new Error(`${url}: no features`);
  ids.sort((a, b) => a - b);

  const supportsGeoJSON = /geojson/i.test(meta.supportedQueryFormats || '');
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  const features = [];
  let done = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const mine = chunks[cursor++];
      const params = {
        objectIds: mine.join(','),
        outFields: outFields.join(','),
        returnGeometry: 'true',
        outSR: '4326',
        geometryPrecision: '5',
        maxAllowableOffset: '0.00002',
        f: supportsGeoJSON ? 'geojson' : 'json',
      };
      const json = await getJSON(`${url}/query`, params);
      const fc = supportsGeoJSON && json.type === 'FeatureCollection' ? json : esriToGeoJSON(json);
      features.push(...fc.features);
      done += mine.length;
      if (onProgress) onProgress(done, ids.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));
  return { type: 'FeatureCollection', features };
}

/* ---- Bundled snapshot fallback (same-origin, works on restricted networks) ---- */

async function loadSnapshot(path) {
  const res = await timeoutFetch(path, { headers: { Accept: 'application/geo+json,application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path}`);
  const fc = await res.json();
  if (!fc || fc.type !== 'FeatureCollection') throw new Error(`${path}: not a FeatureCollection`);
  return fc;
}

/* ---- Public loaders ---- */

async function loadZoning(onProgress, onStatus) {
  let lastErr = null;
  for (const url of ZONING_CANDIDATES) {
    try {
      if (onStatus) onStatus(`Contacting Mesa GIS… (${new URL(url).hostname})`);
      const meta = await inspectLayer(url);
      const name = meta.name || '';
      if (/overlay|history|case/i.test(name)) continue;
      const zoneField = findField(
        meta,
        [/^zoning$/i, /^zone_?code$/i, /^zone$/i, /zoning/i, /zone/i],
        ['esriFieldTypeString']
      );
      if (!zoneField) continue;
      const dscrField = findField(meta, [/^dscr$/i, /descr/i], ['esriFieldTypeString']);
      const outFields = dscrField ? [zoneField, dscrField] : [zoneField];
      if (onStatus) onStatus(`Loading zoning districts (“${name}”)…`);
      const fc = await fetchAllFeatures(url, meta, outFields, onProgress);
      return { fc, zoneField, dscrField, source: url, layerName: name, snapshot: false };
    } catch (e) {
      lastErr = e;
    }
  }
  // Live GIS unreachable — fall back to the bundled snapshot.
  try {
    if (onStatus) onStatus('Live Mesa GIS unreachable — loading bundled snapshot…');
    const fc = await loadSnapshot(SNAPSHOT_ZONING);
    return {
      fc, zoneField: 'Zoning', dscrField: 'Description',
      source: SNAPSHOT_ZONING, layerName: 'Zoning (snapshot)',
      snapshot: true, generated: fc.generated || null,
    };
  } catch (e) {
    throw lastErr || e || new Error('No zoning layer candidate succeeded');
  }
}

async function loadCouncil(onStatus) {
  let lastErr = null;
  for (const url of COUNCIL_CANDIDATES) {
    try {
      const meta = await inspectLayer(url);
      if (!/council/i.test(meta.name || '') && !/council/i.test(url)) continue;
      const distField = findField(meta, [
        /^district$/i, /^dist(rict)?_?(no|num|number|id)?$/i, /council.?dist/i, /^dist/i, /district/i,
      ]);
      const memberField = findField(
        meta,
        [/member/i, /council.?member/i, /representative/i, /^name$/i],
        ['esriFieldTypeString']
      );
      const outFields = [distField, memberField].filter(Boolean);
      if (onStatus) onStatus('Loading council districts…');
      const fc = await fetchAllFeatures(url, meta, outFields.length ? outFields : ['*'], null);
      return { fc, distField, memberField, source: url, snapshot: false };
    } catch (e) {
      lastErr = e;
    }
  }
  try {
    const fc = await loadSnapshot(SNAPSHOT_COUNCIL);
    return { fc, distField: 'DISTRICT', memberField: null, source: SNAPSHOT_COUNCIL, snapshot: true };
  } catch (e) {
    throw lastErr || e || new Error('No council district candidate succeeded');
  }
}

/* ---- Zoning code normalization ----
   Raw values look like "RS-6", "RM-4 PAD", "LC-PAD", "DB-1", "GC", "PEP",
   "RSL-4.5", "AG", "PS", "PC", "AF", sometimes with overlay suffixes.
   Returns { base, category } where base is one of the 15 table districts,
   'RES', 'AG', or 'OTHER'. */

const TABLE_DISTRICT_SET = new Set(window.MesaRules.TABLE_DISTRICTS);

function normalizeZoning(raw) {
  if (!raw) return { base: 'OTHER', display: '' };
  const display = String(raw).trim();
  let s = display.toUpperCase().replace(/[()]/g, ' ');
  // Drop common overlay / modifier suffixes.
  s = s.replace(/\b(PAD|BIZ|HL|HD|CUP|SUP|IDD|FBC?)\b/g, ' ');
  s = s.replace(/[\s/,]+/g, ' ').trim();
  const tokens = s.split(' ');
  for (const tok of tokens) {
    if (TABLE_DISTRICT_SET.has(tok)) return { base: tok, display };
    // e.g. "DB1" / "DR2" without a dash
    const m = tok.match(/^(DR|DB)-?([123])$/);
    if (m) {
      const cand = `${m[1]}-${m[2]}`;
      if (TABLE_DISTRICT_SET.has(cand)) return { base: cand, display };
    }
  }
  const first = tokens[0] || '';
  if (/^(RS|RSL|RM|MH)/.test(first)) return { base: 'RES', display };
  if (/^AG/.test(first)) return { base: 'AG', display };
  return { base: 'OTHER', display };
}

/* ---- Demo fixtures (?demo=1) ----
   A synthetic grid of polygons covering every district category, used for
   offline development and UI previews only. Clearly labeled in the UI. */

function demoData() {
  const codes = [
    'NC', 'LC', 'GC', 'OC', 'MX',
    'PEP', 'LI', 'GI', 'HI', 'RS-6',
    'DR-1', 'DR-2', 'DR-3', 'DB-1', 'DB-2',
    'DC', 'RM-4', 'RSL-4.5', 'AG', 'PS',
  ];
  const lon0 = -111.894, lat0 = 33.47, dl = 0.028;
  const features = [];
  codes.forEach((code, i) => {
    const cx = lon0 + (i % 5) * dl;
    const cy = lat0 - Math.floor(i / 5) * dl;
    const w = dl * 0.92, h = dl * 0.92;
    features.push({
      type: 'Feature',
      properties: { ZONING: code, DSCR: `${code} (demo parcel)` },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [cx, cy], [cx + w, cy], [cx + w, cy - h], [cx, cy - h], [cx, cy],
        ]],
      },
    });
  });
  const council = {
    type: 'FeatureCollection',
    features: [0, 1].map((i) => ({
      type: 'Feature',
      properties: { DISTRICT: i + 1 },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lon0 - 0.004 + i * (2.5 * dl), lat0 + 0.004],
          [lon0 + (2.5 * dl) * (i + 1) + 0.004 - (i ? 0.008 : 0), lat0 + 0.004],
          [lon0 + (2.5 * dl) * (i + 1) + 0.004 - (i ? 0.008 : 0), lat0 - 3.2 * dl],
          [lon0 - 0.004 + i * (2.5 * dl), lat0 - 3.2 * dl],
          [lon0 - 0.004 + i * (2.5 * dl), lat0 + 0.004],
        ]],
      },
    })),
  };
  return {
    zoning: { fc: { type: 'FeatureCollection', features }, zoneField: 'ZONING', dscrField: 'DSCR', source: 'demo', layerName: 'Demo fixture' },
    council: { fc: council, distField: 'DISTRICT', memberField: null, source: 'demo' },
  };
}

window.MesaData = { loadZoning, loadCouncil, normalizeZoning, demoData };
