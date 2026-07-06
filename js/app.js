/* =========================================================================
   Mesa Fleet Services & Service Stations Text Amendment — interactive map.
   ========================================================================= */
(() => {
  const R = window.MesaRules;
  const D = window.MesaData;
  const S = window.MesaZoningSymbology;

  // East Valley view — Mesa plus immediate surroundings; prevents panning to the world.
  const VIEW_BOUNDS = L.latLngBounds([33.24, -111.98], [33.58, -111.48]);

  /* ---------------- Colors (validated palette) ---------------- */
  const COLORS = {
    P:    { fill: '#008300', stroke: '#005c00', fillOpacity: 0.62 },
    PF:   { fill: '#008300', stroke: '#005c00', fillOpacity: 0.62 },
    CUP:  { fill: '#b45309', stroke: '#7c3a06', fillOpacity: 0.66, hatch: true },
    X:    { fill: '#c9c7be', stroke: '#b0aea4', fillOpacity: 0.30 },
    ND:   { fill: '#dad8cf', stroke: '#bab8ae', fillOpacity: 0.22, dashed: true },
    NEW_P:   { fill: '#008300', stroke: '#005c00', fillOpacity: 0.68 },
    NEW_CUP: { fill: '#b45309', stroke: '#7c3a06', fillOpacity: 0.70, hatch: true },
    SAME_ALLOWED: { fill: '#2a78d6', stroke: '#1c5cab', fillOpacity: 0.42 },
    SAME_NO: { fill: '#c9c7be', stroke: '#b0aea4', fillOpacity: 0.22 },
    RES_SEP: { fill: '#4a3aa7', stroke: '#38307c', fillOpacity: 0.34 },
    NEUTRAL: { fill: '#c9c7be', stroke: '#b0aea4', fillOpacity: 0.18 },
  };

  /* Canvas hatch pattern (45° lines) used as fillStyle for CUP polygons. */
  function makeHatch(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, 8, 8);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2, 6); ctx.lineTo(6, -2);
    ctx.moveTo(2, 10); ctx.lineTo(10, 2);
    ctx.stroke();
    return ctx.createPattern(c, 'repeat');
  }
  const HATCH = { CUP: null, NEW_CUP: null };

  /* ---------------- State ---------------- */
  const state = {
    use: 'lightFleet',
    view: 'proposed', // 'current' | 'proposed' | 'changes'
    mesaZoning: false,
    zoningLabels: false,
    council: true,
    zoning: null,       // { fc, zoneField, dscrField, ... }
    council_: null,
    layer: null,
    mesaZoningLayer: null,
    councilLayer: null,
    councilLabels: [],
    zoningLabelMarkers: [],
    demo: /[?&]demo=1/.test(location.search),
  };

  function readHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (h.get('use') && R.USES[h.get('use')]) state.use = h.get('use');
    if (['current', 'proposed', 'changes'].includes(h.get('view'))) state.view = h.get('view');
    if (h.get('zones') === '1') state.mesaZoning = true;
    if (h.get('labels') === '1') state.zoningLabels = true;
    if (h.get('council') === '0') state.council = false;
  }
  function writeHash() {
    const h = new URLSearchParams();
    h.set('use', state.use);
    h.set('view', state.view);
    if (state.mesaZoning) h.set('zones', '1');
    if (state.zoningLabels) h.set('labels', '1');
    if (!state.council) h.set('council', '0');
    history.replaceState(null, '', '#' + h.toString());
  }

  /* ---------------- Status resolution ---------------- */
  function statusFor(useKey, view, base) {
    const use = R.USES[useKey];
    if (base === 'RES' || base === 'AG' || base === 'OTHER') {
      if (useKey === 'serviceStations') return base === 'RES' ? 'RES_SEP_TARGET' : 'NEUTRAL';
      if (view === 'current' && use.currentUndefined) return 'ND';
      return 'X';
    }
    if (useKey === 'serviceStations') return 'NEUTRAL';
    return (view === 'current' ? use.current : use.proposed)[base] || 'X';
  }

  function styleKeyFor(useKey, view, base) {
    if (useKey === 'serviceStations') {
      return base === 'RES' ? 'RES_SEP' : 'NEUTRAL';
    }
    if (view === 'changes') {
      if (base === 'RES' || base === 'AG' || base === 'OTHER') return 'SAME_NO';
      const use = R.USES[useKey];
      const ch = R.classifyChange(use.current[base] || 'X', use.proposed[base] || 'X');
      return ch === 'NEW_P' ? 'NEW_P'
        : ch === 'NEW_CUP' ? 'NEW_CUP'
        : ch === 'SAME_ALLOWED' ? 'SAME_ALLOWED'
        : 'SAME_NO';
    }
    const st = statusFor(useKey, view, base);
    return st === 'RES_SEP_TARGET' ? 'RES_SEP' : st === 'NEUTRAL' ? 'NEUTRAL' : st;
  }

  function styleForFeature(feat) {
    const base = feat._mesaBase;
    const key = styleKeyFor(state.use, state.view, base);
    const c = COLORS[key];
    const useHatch = c.hatch && HATCH[key === 'NEW_CUP' ? 'NEW_CUP' : 'CUP'];
    let fillOpacity = c.fillOpacity;
    // When the Mesa reference layer is on, lighten the amendment fill so official
    // zoning colors remain visible underneath.
    if (state.mesaZoning) fillOpacity *= 0.48;
    return {
      fillColor: useHatch || c.fill,
      color: c.stroke,
      weight: 0.7,
      opacity: state.mesaZoning ? 0.82 : 0.9,
      fillOpacity,
      dashArray: c.dashed ? '3 3' : null,
    };
  }

  /* ---------------- Map setup ---------------- */
  const map = L.map('map', {
    zoomControl: false,
    preferCanvas: true,
    attributionControl: true,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: VIEW_BOUNDS,
    maxBoundsViscosity: 1.0,
  }).setView([33.415, -111.72], 11);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.attributionControl.setPrefix(false);

  const basemap = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · Zoning &amp; districts: <a href="https://opengis.mesaaz.gov/">City of Mesa GIS</a>',
    }
  ).addTo(map);
  basemap.on('tileerror', () => {
    document.getElementById('map').classList.add('no-basemap');
  });

  const canvasRenderer = L.canvas({ padding: 0.3 });
  const refCanvasRenderer = L.canvas({ padding: 0.3 });
  HATCH.CUP = makeHatch(COLORS.CUP.fill);
  HATCH.NEW_CUP = makeHatch(COLORS.NEW_CUP.fill);

  /* ---------------- Popups ---------------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function statusChip(code) {
    const meta = R.STATUS_META[code] || R.STATUS_META.X;
    const cls = code === 'P' || code === 'PF' ? 'chip-p' : code === 'CUP' ? 'chip-cup' : code === 'ND' ? 'chip-nd' : 'chip-x';
    return `<span class="chip ${cls}">${esc(meta.short)}</span> ${esc(meta.label)}`;
  }

  function popupHTML(feat) {
    const base = feat._mesaBase;
    const raw = feat._mesaRaw || '';
    const dscr = feat._mesaDscr || '';
    const name = R.DISTRICT_NAMES[base] || dscr || base;
    const use = R.USES[state.use];
    let body;
    if (state.use === 'serviceStations') {
      body =
        base === 'RES'
          ? `<p class="pp-note"><strong>Residential district.</strong> Under the proposal, service station fuel pumps and EV chargers must keep a 100-ft separation from residential uses and districts like this one (reducible only with a sound study, ≤60 dB).</p>`
          : `<p class="pp-note">This amendment updates service station <em>standards</em> citywide; it does not change which districts allow service stations.</p>`;
    } else {
      const cur = statusFor(state.use, 'current', base);
      const pro = statusFor(state.use, 'proposed', base);
      const ch = R.classifyChange(cur === 'ND' ? 'X' : cur, pro);
      const badge =
        ch === 'NEW_P' ? '<span class="delta delta-new">NEW — permitted under the amendment</span>'
        : ch === 'NEW_CUP' ? '<span class="delta delta-new">NEW — allowed with Council Use Permit</span>'
        : ch === 'SAME_ALLOWED' ? '<span class="delta delta-same">No change in permission</span>'
        : '<span class="delta delta-none">Not allowed in either version</span>';
      body = `
        <table class="pp-table">
          <tr><th>Today</th><td>${statusChip(cur)}</td></tr>
          <tr><th>Proposed</th><td>${statusChip(pro)}</td></tr>
        </table>
        ${badge}`;
    }
    return `
      <div class="pp">
        <div class="pp-zone">${esc(raw || base)}</div>
        <div class="pp-name">${esc(name)}</div>
        <div class="pp-use">${esc(use.name)}</div>
        ${body}
      </div>`;
  }

  /* ---------------- Rendering: zoning layer ---------------- */
  function ringArea(ring) {
    let a = 0;
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % n];
      a += x1 * y2 - x2 * y1;
    }
    return a / 2;
  }

  function featureArea(geom) {
    if (geom.type === 'Polygon') return Math.abs(ringArea(geom.coordinates[0]));
    let a = 0;
    for (const poly of geom.coordinates) a += Math.abs(ringArea(poly[0]));
    return a;
  }

  function prepLabelMeta(feat, zoneField) {
    if (!feat._mesaLabelAt) {
      feat._mesaLabelAt = polylabelish(feat.geometry);
      feat._mesaLabelArea = featureArea(feat.geometry);
      const raw = feat._mesaRaw || feat.properties[zoneField] || '';
      feat._mesaLabelText = S.zoneColorKey(raw) || raw;
    }
  }

  function syncLayerOrder() {
    if (state.mesaZoningLayer && state.mesaZoning) state.mesaZoningLayer.bringToBack();
    if (state.layer) state.layer.bringToFront();
    if (state.councilLayer && state.council) state.councilLayer.bringToFront();
    // Markers don't support bringToFront in Leaflet — use zIndexOffset instead.
    state.councilLabels.forEach((m) => m.setZIndexOffset(600));
    state.zoningLabelMarkers.forEach((m) => m.setZIndexOffset(800));
  }

  function buildZoningLayer() {
    if (state.layer) { map.removeLayer(state.layer); state.layer = null; }
    const { fc, zoneField, dscrField } = state.zoning;
    for (const f of fc.features) {
      if (!f._mesaBase) {
        const norm = D.normalizeZoning(f.properties[zoneField]);
        f._mesaBase = norm.base;
        f._mesaRaw = norm.display;
        f._mesaDscr = dscrField ? f.properties[dscrField] : '';
      }
      prepLabelMeta(f, zoneField);
    }
    state.layer = L.geoJSON(fc, {
      renderer: canvasRenderer,
      style: styleForFeature,
      onEachFeature: (feat, lyr) => {
        lyr.bindPopup(() => popupHTML(feat), { maxWidth: 320, className: 'mesa-popup' });
        lyr.on('mouseover', () => lyr.setStyle({ weight: 2, opacity: 1 }));
        lyr.on('mouseout', () => lyr.setStyle(styleForFeature(feat)));
      },
    }).addTo(map);
    buildMesaZoningLayer();
    syncLayerOrder();
    applyViewBounds();
  }

  function applyViewBounds() {
    try {
      const dataBounds = state.layer && state.layer.getBounds();
      if (dataBounds && dataBounds.isValid()) {
        map.fitBounds(dataBounds.pad(0.04), { maxZoom: 13 });
      } else {
        map.fitBounds(VIEW_BOUNDS);
      }
      const minZ = map.getBoundsZoom(VIEW_BOUNDS, false);
      if (minZ > map.getMinZoom()) map.setMinZoom(minZ);
    } catch (_) {
      map.fitBounds(VIEW_BOUNDS);
    }
  }

  function buildMesaZoningLayer() {
    if (state.mesaZoningLayer) {
      map.removeLayer(state.mesaZoningLayer);
      state.mesaZoningLayer = null;
    }
    if (!state.zoning) return;
    const { fc, zoneField } = state.zoning;
    state.mesaZoningLayer = L.geoJSON(fc, {
      interactive: false,
      renderer: refCanvasRenderer,
      style: (feat) => S.mesaZoningStyle(feat.properties[zoneField], { fillOpacity: 0.55, weight: 0.4 }),
    });
    updateMesaZoningVisibility();
  }

  function updateMesaZoningVisibility() {
    if (!state.mesaZoningLayer) return;
    if (state.mesaZoning) {
      state.mesaZoningLayer.addTo(map);
      state.mesaZoningLayer.bringToBack();
    } else {
      map.removeLayer(state.mesaZoningLayer);
    }
    syncLayerOrder();
  }

  /* Scale-aware zoning labels: larger parcels first, grid collision avoidance. */
  const LABEL_GRID_PX = 44;
  const LABEL_MIN_AREA = [0.000004, 0.0000015, 0.0000004, 0.0000001, 0.000000025];
  const LABEL_MAX_COUNT = [48, 96, 180, 320, 520];
  let labelRefreshTimer = null;

  function labelSizeClass(zoom) {
    if (zoom >= 15) return 'zl-lg';
    if (zoom >= 13) return 'zl-md';
    return 'zl-sm';
  }

  function clearZoningLabels() {
    state.zoningLabelMarkers.forEach((m) => map.removeLayer(m));
    state.zoningLabelMarkers = [];
  }

  function refreshZoningLabels() {
    clearZoningLabels();
    if (!state.zoningLabels || !state.zoning) return;
    const zoom = map.getZoom();
    if (zoom < 10) return;

    const zi = Math.min(zoom - 10, LABEL_MIN_AREA.length - 1);
    const minArea = LABEL_MIN_AREA[zi];
    const maxCount = LABEL_MAX_COUNT[zi];
    const sizeClass = labelSizeClass(zoom);
    const bounds = map.getBounds().pad(-0.015);
    const { fc } = state.zoning;
    const candidates = [];

    for (const f of fc.features) {
      if (!f._mesaLabelAt || f._mesaLabelArea < minArea) continue;
      if (!bounds.contains(f._mesaLabelAt)) continue;
      candidates.push(f);
    }
    candidates.sort((a, b) => b._mesaLabelArea - a._mesaLabelArea);

    const occupied = new Set();
    let placed = 0;
    for (const f of candidates) {
      if (placed >= maxCount) break;
      const pt = map.latLngToContainerPoint(f._mesaLabelAt);
      const gx = Math.floor(pt.x / LABEL_GRID_PX);
      const gy = Math.floor(pt.y / LABEL_GRID_PX);
      let blocked = false;
      for (let dx = -1; dx <= 1 && !blocked; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (occupied.has(`${gx + dx},${gy + dy}`)) blocked = true;
        }
      }
      if (blocked) continue;
      occupied.add(`${gx},${gy}`);
      state.zoningLabelMarkers.push(L.marker(f._mesaLabelAt, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: `zone-label ${sizeClass}`,
          html: `<span>${esc(f._mesaLabelText)}</span>`,
          iconSize: null,
        }),
      }).addTo(map));
      placed++;
    }
    syncLayerOrder();
  }

  function scheduleLabelRefresh() {
    if (!state.zoningLabels) return;
    clearTimeout(labelRefreshTimer);
    labelRefreshTimer = setTimeout(refreshZoningLabels, 90);
  }

  function updateZoningLabelsVisibility() {
    if (state.zoningLabels) refreshZoningLabels();
    else clearZoningLabels();
    syncLayerOrder();
  }

  map.on('zoomend moveend', scheduleLabelRefresh);

  function restyle() {
    if (state.layer) state.layer.setStyle(styleForFeature);
  }

  /* ---------------- Council districts ---------------- */
  function polylabelish(geom) {
    // Label anchor: centroid of the largest ring's bounding box.
    let best = null, bestArea = -1;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) {
      const ring = poly[0];
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (const [x, y] of ring) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      const a = (maxx - minx) * (maxy - miny);
      if (a > bestArea) { bestArea = a; best = [(miny + maxy) / 2, (minx + maxx) / 2]; }
    }
    return best;
  }

  function buildCouncilLayer() {
    if (!state.council_) return;
    const { fc, distField, memberField } = state.council_;
    state.councilLayer = L.geoJSON(fc, {
      interactive: false,
      renderer: canvasRenderer, // share the zoning canvas so clicks reach zoning polygons
      style: {
        fill: false,
        color: '#0b0b0b',
        weight: 2.4,
        opacity: 0.85,
        dashArray: '8 5',
      },
    });
    state.councilLabels = fc.features.map((f) => {
      const num = distField ? f.properties[distField] : '?';
      const member = memberField ? f.properties[memberField] : null;
      const at = polylabelish(f.geometry);
      if (!at) return null;
      return L.marker(at, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'council-label',
          html: `<div class="cl-badge">CD&nbsp;${esc(num)}</div>${member ? `<div class="cl-member">${esc(member)}</div>` : ''}`,
          iconSize: null,
        }),
      });
    }).filter(Boolean);
    updateCouncilVisibility();
  }

  function updateCouncilVisibility() {
    if (!state.councilLayer) return;
    if (state.council) {
      state.councilLayer.addTo(map);
      state.councilLabels.forEach((m) => m.addTo(map));
    } else {
      map.removeLayer(state.councilLayer);
      state.councilLabels.forEach((m) => map.removeLayer(m));
    }
    syncLayerOrder();
  }

  /* ---------------- Legend ---------------- */
  function legendRow(swatchClass, label) {
    return `<div class="lg-row"><span class="lg-swatch ${swatchClass}"></span><span>${label}</span></div>`;
  }

  function renderLegend() {
    const el = document.getElementById('legend');
    const use = R.USES[state.use];
    let rows = '';
    if (state.use === 'serviceStations') {
      rows =
        legendRow('sw-res', 'Residential districts (RS, RSL, RM) — new 100-ft pump/charger separation applies') +
        legendRow('sw-neutral', 'All other districts — standards update only; allowed locations unchanged');
    } else if (state.view === 'changes') {
      rows =
        legendRow('sw-p', 'Newly permitted') +
        legendRow('sw-cup', 'Newly allowed with Council Use Permit (CUP)') +
        (use.currentUndefined ? '' : legendRow('sw-same', 'Allowed today — no change')) +
        legendRow('sw-x', 'Not allowed (no change)');
    } else if (state.view === 'current' && use.currentUndefined) {
      rows = legendRow('sw-nd', 'Not a defined use classification in today’s code');
    } else {
      rows =
        legendRow('sw-p', state.use === 'accEV' ? 'Permitted * (footnote limits apply)' : 'Permitted by right') +
        (hasStatus(use, state.view, 'CUP') ? legendRow('sw-cup', 'Council Use Permit (CUP) required') : '') +
        legendRow('sw-x', 'Not permitted');
    }
    el.innerHTML = `<div class="lg-title">Legend</div>${rows}` +
      (state.mesaZoning ? legendRow('sw-mesa-zoning', 'Mesa Zoning Layer (reference)') : '') +
      (state.zoningLabels ? legendRow('sw-zone-label', 'Zoning district code labels') : '') +
      (state.council ? legendRow('sw-council', 'City Council district boundary') : '');
  }

  function hasStatus(use, view, code) {
    const m = view === 'current' ? use.current : use.proposed;
    return Object.values(m).includes(code);
  }

  /* ---------------- Info panel ---------------- */
  function cellHTML(code, changed) {
    const meta = R.STATUS_META[code] || R.STATUS_META.X;
    const cls =
      code === 'P' || code === 'PF' ? 'cell-p' : code === 'CUP' ? 'cell-cup' : code === 'ND' ? 'cell-nd' : 'cell-x';
    return `<td class="${cls}${changed ? ' cell-changed' : ''}">${esc(meta.short)}${changed ? '<span class="cell-new">NEW</span>' : ''}</td>`;
  }

  function renderMatrix(use) {
    if (use.standardsOnly) return '';
    let html = `<table class="matrix"><thead><tr><th>District</th><th>Today</th><th>Proposed</th></tr></thead><tbody>`;
    for (const group of R.DISTRICT_GROUPS) {
      html += `<tr class="matrix-group"><td colspan="3">${esc(group.label)}</td></tr>`;
      for (const d of group.districts) {
        const cur = use.currentUndefined ? 'ND' : (use.current[d] || 'X');
        const pro = use.proposed[d] || 'X';
        const changed = R.classifyChange(cur === 'ND' ? 'X' : cur, pro).startsWith('NEW');
        html += `<tr><th scope="row"><abbr title="${esc(R.DISTRICT_NAMES[d] || d)}">${esc(d)}</abbr></th>${cellHTML(cur, false)}${cellHTML(pro, changed)}</tr>`;
      }
    }
    html += `</tbody></table>`;
    if (use.footnote) html += `<p class="footnote">${esc(use.footnote)}</p>`;
    return html;
  }

  function renderStandardsCompare(use) {
    const li = (arr) => arr.map((t) => `<li>${esc(t)}</li>`).join('');
    return `
      <div class="std-compare">
        <div class="std-col">
          <h4>Today — Section 11-31-25</h4>
          <ul>${li(use.currentStandards)}</ul>
        </div>
        <div class="std-col std-col-new">
          <h4>Proposed — Section 11-31-25 (amended)</h4>
          <ul>${li(use.proposedStandards)}</ul>
        </div>
      </div>`;
  }

  function renderPanel() {
    const use = R.USES[state.use];
    const el = document.getElementById('panel-body');
    const note = state.view === 'current' ? use.currentNote : use.proposedNote;
    let changes = '';
    if (state.view === 'changes' || use.standardsOnly) {
      changes = `<ul class="changes">${use.changeSummary
        .map((c) => `<li class="chg chg-${c.kind}">${esc(c.text)}</li>`)
        .join('')}</ul>`;
    }
    el.innerHTML = `
      <div class="use-head">
        <span class="use-badge">${esc(use.badge)}</span>
        <h2>${esc(use.name)}</h2>
        <p class="tagline">${esc(use.tagline)}</p>
      </div>
      ${use.standardsOnly ? '' : `<p class="note">${esc(note || '')}</p>`}
      ${changes}
      ${use.standardsOnly ? renderStandardsCompare(use) : `<h3 class="matrix-title">Land-use table — Today vs. Proposed</h3>${renderMatrix(use)}`}
    `;
  }

  /* ---------------- Controls ---------------- */
  function renderTabs() {
    const el = document.getElementById('use-tabs');
    el.innerHTML = R.USE_ORDER.map((k) => {
      const u = R.USES[k];
      return `<button class="tab${k === state.use ? ' active' : ''}" role="tab" aria-selected="${k === state.use}" data-use="${k}">
        ${esc(u.short)}${u.currentUndefined || u.badge.startsWith('New') ? '<span class="tab-new">NEW</span>' : ''}
      </button>`;
    }).join('');
    el.querySelectorAll('.tab').forEach((b) =>
      b.addEventListener('click', () => {
        state.use = b.dataset.use;
        if (R.USES[state.use].standardsOnly) {
          document.getElementById('view-toggle').classList.add('disabled');
        } else {
          document.getElementById('view-toggle').classList.remove('disabled');
        }
        update();
      })
    );
  }

  function renderViewToggle() {
    document.querySelectorAll('#view-toggle .vt').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === state.view);
      b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
    });
  }

  function update() {
    renderTabs();
    renderViewToggle();
    renderLegend();
    renderPanel();
    restyle();
    writeHash();
  }

  /* ---------------- Loading flow ---------------- */
  const loadEl = document.getElementById('loading');
  const loadMsg = document.getElementById('loading-msg');
  const loadBar = document.getElementById('loading-bar-fill');

  function setStatus(msg) { loadMsg.textContent = msg; }
  function setProgress(done, total) {
    loadBar.style.width = `${Math.round((done / total) * 100)}%`;
    setStatus(`Loading zoning districts… ${done.toLocaleString()} of ${total.toLocaleString()} areas`);
  }

  function noteSnapshotInAbout(generated) {
    const el = document.getElementById('about-snapshot-note');
    if (!el) return;
    const when = generated ? ` (captured ${esc(generated)})` : '';
    el.textContent =
      `This session is using an offline snapshot of Mesa GIS data${when} because the live service was unreachable on your network. The map still shows real adopted zoning; it may not reflect the very latest GIS edits.`;
    el.hidden = false;
  }

  function showError(err) {
    loadEl.innerHTML = `
      <div class="load-card error">
        <h2>Couldn’t load zoning data</h2>
        <p>The map tries live data from <code>gis.mesaaz.gov</code> and, if that’s unreachable,
        a bundled snapshot shipped with the site. Both failed to load — this is unusual and may
        indicate a network block on this site’s own files.</p>
        <p class="err-detail">${esc(err && err.message ? err.message : String(err))}</p>
        <button id="retry" class="btn">Try again</button>
        <a class="btn btn-ghost" href="?demo=1">Open UI demo (synthetic data)</a>
      </div>`;
    document.getElementById('retry').addEventListener('click', () => location.reload());
  }

  async function boot() {
    readHash();
    if (R.USES[state.use].standardsOnly) document.getElementById('view-toggle').classList.add('disabled');
    document.getElementById('mesa-zoning-toggle').checked = state.mesaZoning;
    document.getElementById('zoning-labels-toggle').checked = state.zoningLabels;
    document.getElementById('council-toggle').checked = state.council;
    update();

    try {
      if (state.demo) {
        document.getElementById('demo-banner').hidden = false;
        const d = D.demoData();
        state.zoning = d.zoning;
        state.council_ = d.council;
      } else {
        setStatus('Contacting Mesa GIS…');
        const [zoning, council] = await Promise.all([
          D.loadZoning(setProgress, setStatus),
          D.loadCouncil(setStatus).catch(() => null), // council overlay is optional
        ]);
        state.zoning = zoning;
        state.council_ = council;
        if (!council) {
          document.getElementById('council-row').classList.add('unavailable');
          document.getElementById('council-toggle').disabled = true;
        }
        if (zoning.snapshot) noteSnapshotInAbout(zoning.generated);
      }
      buildZoningLayer();
      buildCouncilLayer();
      renderLegend();
      loadEl.classList.add('done');
      setTimeout(() => loadEl.remove(), 450);
    } catch (err) {
      console.error(err);
      showError(err);
    }
  }

  /* ---------------- Wire up static controls ---------------- */
  document.querySelectorAll('#view-toggle .vt').forEach((b) =>
    b.addEventListener('click', () => {
      if (document.getElementById('view-toggle').classList.contains('disabled')) return;
      state.view = b.dataset.view;
      update();
    })
  );
  document.getElementById('mesa-zoning-toggle').addEventListener('change', (e) => {
    state.mesaZoning = e.target.checked;
    updateMesaZoningVisibility();
    restyle();
    renderLegend();
    writeHash();
  });
  document.getElementById('zoning-labels-toggle').addEventListener('change', (e) => {
    state.zoningLabels = e.target.checked;
    updateZoningLabelsVisibility();
    renderLegend();
    writeHash();
  });
  document.getElementById('council-toggle').addEventListener('change', (e) => {
    state.council = e.target.checked;
    updateCouncilVisibility();
    renderLegend();
    writeHash();
  });
  document.getElementById('panel-collapse').addEventListener('click', () => {
    document.body.classList.toggle('panel-collapsed');
    setTimeout(() => map.invalidateSize(), 320);
  });
  document.getElementById('about-open').addEventListener('click', () => {
    document.getElementById('about').showModal();
  });
  document.getElementById('about-close').addEventListener('click', () => {
    document.getElementById('about').close();
  });

  window.__mesa = { map, state };
  boot();
})();
