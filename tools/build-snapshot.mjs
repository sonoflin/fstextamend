/* Regenerate the bundled Mesa GIS snapshot used as an offline/restricted-network
   fallback (data/zoning.geojson, data/council.geojson).

   Usage (from repo root):
     node tools/build-snapshot.mjs [maxAllowableOffset]

   The default offset (~3 m) keeps the zoning file small while preserving
   boundary fidelity. Requires network access to gis.mesaaz.gov. */

import fs from 'fs';

const ZONING = 'https://gis.mesaaz.gov/mesaaz/rest/services/Planning/ZoningOverlay/MapServer/1';
const COUNCIL = 'https://gis.mesaaz.gov/mesaaz/rest/services/BaseMap/MesaDistricts/MapServer/2';
const CHUNK = 700;

async function post(url, params) {
  const body = new URLSearchParams({ f: 'json', ...params });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j;
}

async function fetchLayer(url, outFields, offset) {
  const ids = (await post(`${url}/query`, { where: '1=1', returnIdsOnly: 'true' })).objectIds || [];
  ids.sort((a, b) => a - b);
  const feats = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const j = await post(`${url}/query`, {
      objectIds: ids.slice(i, i + CHUNK).join(','),
      outFields: outFields.join(','),
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      maxAllowableOffset: String(offset),
      f: 'geojson',
    });
    feats.push(...(j.features || []));
  }
  return feats;
}

function write(path, features, keep) {
  const slim = features.map((f) => {
    const src = f.properties || {};
    const properties = {};
    for (const k of keep) properties[k] = src[k];
    return { type: 'Feature', properties, geometry: f.geometry };
  }).filter((f) => f.geometry);
  const fc = { type: 'FeatureCollection', generated: new Date().toISOString().slice(0, 10), features: slim };
  fs.writeFileSync(path, JSON.stringify(fc));
  console.log(`${path}: ${slim.length} features, ${fs.statSync(path).size} bytes`);
}

const offset = Number(process.argv[2] || '0.00003');
console.log('maxAllowableOffset', offset);
write('data/zoning.geojson', await fetchLayer(ZONING, ['Zoning', 'Description'], offset), ['Zoning', 'Description']);
write('data/council.geojson', await fetchLayer(COUNCIL, ['DISTRICT'], offset), ['DISTRICT']);
