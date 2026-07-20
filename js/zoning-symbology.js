/* Official City of Mesa zoning symbology (Planning/ZoningOverlay layer renderer). */
const MESA_ZONING_COLORS={
  "DEFAULT": {
    "fill": "rgb(200,200,200)",
    "stroke": "rgb(156,156,156)"
  },
  "AG": {
    "fill": "rgb(100,184,77)",
    "stroke": "rgb(156,156,156)"
  },
  "DB-1": {
    "fill": "rgb(191,210,255)",
    "stroke": "rgb(156,156,156)"
  },
  "DB-2": {
    "fill": "rgb(115,178,255)",
    "stroke": "rgb(156,156,156)"
  },
  "DC": {
    "fill": "rgb(0,112,184)",
    "stroke": "rgb(156,156,156)"
  },
  "DR-1": {
    "fill": "rgb(255,235,176)",
    "stroke": "rgb(156,156,156)"
  },
  "DR-2": {
    "fill": "rgb(255,205,89)",
    "stroke": "rgb(156,156,156)"
  },
  "DR-3": {
    "fill": "rgb(255,170,0)",
    "stroke": "rgb(156,156,156)"
  },
  "EO": {
    "fill": "rgb(158,215,194)",
    "stroke": "rgb(110,110,110)"
  },
  "LI": {
    "fill": "rgb(156,223,255)",
    "stroke": "rgb(156,156,156)"
  },
  "GI": {
    "fill": "rgb(102,153,205)",
    "stroke": "rgb(156,156,156)"
  },
  "HI": {
    "fill": "rgb(61,102,137)",
    "stroke": "rgb(156,156,156)"
  },
  "ID-1": {
    "fill": "rgb(255,153,226)",
    "stroke": "rgb(156,156,156)"
  },
  "ID-2": {
    "fill": "rgb(255,115,222)",
    "stroke": "rgb(156,156,156)"
  },
  "MX": {
    "fill": "rgb(140,235,173)",
    "stroke": "rgb(156,156,156)"
  },
  "OC": {
    "fill": "rgb(197,135,243)",
    "stroke": "rgb(156,156,156)"
  },
  "LC": {
    "fill": "rgb(255,167,127)",
    "stroke": "rgb(156,156,156)"
  },
  "NC": {
    "fill": "rgb(245,122,122)",
    "stroke": "rgb(156,156,156)"
  },
  "GC": {
    "fill": "rgb(226,82,82)",
    "stroke": "rgb(156,156,156)"
  },
  "PC": {
    "fill": "rgb(205,102,153)",
    "stroke": "rgb(156,156,156)"
  },
  "PEP": {
    "fill": "rgb(219,131,129)",
    "stroke": "rgb(156,156,156)"
  },
  "PS": {
    "fill": "rgb(232,199,204)",
    "stroke": "rgb(156,156,156)"
  },
  "RM-2": {
    "fill": "rgb(255,210,128)",
    "stroke": "rgb(156,156,156)"
  },
  "RM-3": {
    "fill": "rgb(250,197,100)",
    "stroke": "rgb(156,156,156)"
  },
  "RM-4": {
    "fill": "rgb(245,185,73)",
    "stroke": "rgb(156,156,156)"
  },
  "RM-3U": {
    "fill": "rgb(240,173,48)",
    "stroke": "rgb(156,156,156)"
  },
  "RM-4U": {
    "fill": "rgb(235,161,23)",
    "stroke": "rgb(156,156,156)"
  },
  "RM-5": {
    "fill": "rgb(230,153,0)",
    "stroke": "rgb(156,156,156)"
  },
  "RS-90": {
    "fill": "rgb(255,255,191)",
    "stroke": "rgb(156,156,156)"
  },
  "RS-43": {
    "fill": "rgb(250,250,157)",
    "stroke": "rgb(156,156,156)"
  },
  "RS-35": {
    "fill": "rgb(245,245,122)",
    "stroke": "rgb(156,156,156)"
  },
  "RS-15": {
    "fill": "rgb(240,240,91)",
    "stroke": "rgb(156,156,156)"
  },
  "RS-9": {
    "fill": "rgb(237,237,59)",
    "stroke": "rgb(156,156,156)"
  },
  "RS-7": {
    "fill": "rgb(232,232,30)",
    "stroke": "rgb(156,156,156)"
  },
  "RS-6": {
    "fill": "rgb(230,230,0)",
    "stroke": "rgb(156,156,156)"
  },
  "RSL-4.5": {
    "fill": "rgb(255,235,176)",
    "stroke": "rgb(156,156,156)"
  },
  "RSL-4.0": {
    "fill": "rgb(255,217,161)",
    "stroke": "rgb(156,156,156)"
  },
  "RSL-3.0": {
    "fill": "rgb(255,195,145)",
    "stroke": "rgb(156,156,156)"
  },
  "RSL-2.5": {
    "fill": "rgb(255,168,128)",
    "stroke": "rgb(156,156,156)"
  },
  "T3N": {
    "fill": "rgb(115,255,222)",
    "stroke": "rgb(156,156,156)"
  },
  "T4MS": {
    "fill": "rgb(94,242,208)",
    "stroke": "rgb(156,156,156)"
  },
  "T4N": {
    "fill": "rgb(76,230,194)",
    "stroke": "rgb(156,156,156)"
  },
  "T4NF": {
    "fill": "rgb(56,217,179)",
    "stroke": "rgb(156,156,156)"
  },
  "T5MS": {
    "fill": "rgb(41,204,166)",
    "stroke": "rgb(156,156,156)"
  },
  "T5MSF": {
    "fill": "rgb(25,191,152)",
    "stroke": "rgb(156,156,156)"
  },
  "T5N": {
    "fill": "rgb(12,179,140)",
    "stroke": "rgb(156,156,156)"
  },
  "T6MS": {
    "fill": "rgb(0,168,132)",
    "stroke": "rgb(156,156,156)"
  }
};

function zoneColorKey(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase().replace(/[()]/g, ' ');
  return s.split(/[\s/,]+/).find(Boolean) || null;
}

function mesaZoningStyle(raw, opts = {}) {
  const key = zoneColorKey(raw);
  const c = MESA_ZONING_COLORS[key] || MESA_ZONING_COLORS.DEFAULT;
  const fillOpacity = opts.fillOpacity ?? 0.38;
  const weight = opts.weight ?? 0.35;
  return { fillColor: c.fill, color: c.stroke, weight, opacity: 0.75, fillOpacity };
}

/* Residential district groups from City of Mesa Zoning field values.
   Yellow family (conventional residential map color) — distinct from
   amendment green / CUP amber / same-allowed blue, with darker shades
   for denser residential types. */
const RESIDENTIAL_GROUPS = {
  single: {
    id: 'single',
    label: 'Single Residence (RS)',
    match: /^RS-/,
    fill: '#fff0a8',
    stroke: '#c9a227',
  },
  smallLot: {
    id: 'smallLot',
    label: 'Small Lot Single Residence (RSL)',
    match: /^RSL-/,
    fill: '#ffe066',
    stroke: '#b8911a',
  },
  multi: {
    id: 'multi',
    label: 'Multiple Residence (RM)',
    match: /^RM-/,
    fill: '#f0c42e',
    stroke: '#9a7a12',
  },
  downtown: {
    id: 'downtown',
    label: 'Downtown Residential (DR)',
    match: /^DR-/,
    fill: '#e0a818',
    stroke: '#8a6a0e',
  },
  fbcNeighborhood: {
    id: 'fbcNeighborhood',
    label: 'Form-Based Neighborhood (T3N–T5N)',
    match: /^(T3N|T4N|T4NF|T5N)$/,
    fill: '#f5d24a',
    stroke: '#a88818',
  },
};

const RESIDENTIAL_GROUP_ORDER = ['single', 'smallLot', 'multi', 'downtown', 'fbcNeighborhood'];

function residentialGroup(raw) {
  const key = zoneColorKey(raw);
  if (!key) return null;
  for (const id of RESIDENTIAL_GROUP_ORDER) {
    if (RESIDENTIAL_GROUPS[id].match.test(key)) return RESIDENTIAL_GROUPS[id];
  }
  return null;
}

function residentialStyle(raw, opts = {}) {
  const g = residentialGroup(raw);
  if (!g) {
    return {
      fillColor: 'transparent',
      color: 'transparent',
      weight: 0,
      opacity: 0,
      fillOpacity: 0,
    };
  }
  const fillOpacity = opts.fillOpacity ?? 0.42;
  const weight = opts.weight ?? 0.35;
  return {
    fillColor: g.fill,
    color: g.stroke,
    weight,
    opacity: 0.7,
    fillOpacity,
  };
}

window.MesaZoningSymbology = {
  MESA_ZONING_COLORS,
  zoneColorKey,
  mesaZoningStyle,
  RESIDENTIAL_GROUPS,
  RESIDENTIAL_GROUP_ORDER,
  residentialGroup,
  residentialStyle,
};