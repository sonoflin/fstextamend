/* =========================================================================
   Mesa Zoning Ordinance — Fleet Services & Service Stations Text Amendment
   Use-permission data model.

   Source of truth: Exhibit 1 (Fleet Services & Service Station Ordinance),
   amending Tables 11-6-2 (Commercial), 11-7-2 (Employment) and 11-8-2
   (Downtown), plus Exhibit 2 (new Section 11-31-40) and the June 24, 2026
   Planning & Zoning Board staff report.

   Status codes:
     'P'   Permitted by right
     'PF'  Permitted by right, subject to table footnotes (shown as "P *")
     'CUP' Requires a Council Use Permit
     'X'   Not permitted (listed use, "—" in the table)
     'ND'  Not a defined use classification under this version of the code
   ========================================================================= */

const DISTRICT_GROUPS = [
  {
    key: 'commercial',
    label: 'Commercial Districts (Table 11-6-2)',
    districts: ['NC', 'LC', 'GC', 'OC', 'MX'],
  },
  {
    key: 'employment',
    label: 'Employment Districts (Table 11-7-2)',
    districts: ['PEP', 'LI', 'GI', 'HI'],
  },
  {
    key: 'downtown',
    label: 'Downtown Districts (Table 11-8-2)',
    districts: ['DR-1', 'DR-2', 'DR-3', 'DB-1', 'DB-2', 'DC'],
  },
];

const DISTRICT_NAMES = {
  'NC': 'Neighborhood Commercial',
  'LC': 'Limited Commercial',
  'GC': 'General Commercial',
  'OC': 'Office Commercial',
  'MX': 'Mixed Use',
  'PEP': 'Planned Employment Park',
  'LI': 'Light Industrial',
  'GI': 'General Industrial',
  'HI': 'Heavy Industrial',
  'DR-1': 'Downtown Residential 1',
  'DR-2': 'Downtown Residential 2',
  'DR-3': 'Downtown Residential 3',
  'DB-1': 'Downtown Business 1',
  'DB-2': 'Downtown Business 2',
  'DC': 'Downtown Core',
  'RES': 'Residential Districts (RS, RSL, RM)',
  'AG': 'Agricultural',
  'OTHER': 'Other / Special Districts',
};

/* All 15 districts that appear in the three amended land-use tables. */
const TABLE_DISTRICTS = DISTRICT_GROUPS.flatMap((g) => g.districts);

/* Fill a status map: every table district defaults to `fallback`,
   then apply the explicit entries. */
function statusMap(entries, fallback) {
  const m = {};
  for (const d of TABLE_DISTRICTS) m[d] = fallback;
  return Object.assign(m, entries);
}

const USES = {
  lightFleet: {
    short: 'Light Fleet',
    name: 'Light Fleet-Based Services',
    badge: 'Definition revised',
    tagline:
      'Fleets of smaller vehicles — under 10,000 lbs, 50 or fewer vehicles, ' +
      'less than 10,000 sq ft of fleet area. Includes ground- and aerial-based ' +
      '(drone) fleets under the proposed definition.',
    current: statusMap(
      { GC: 'P', LI: 'P', GI: 'P', HI: 'P', 'DB-2': 'P', DC: 'CUP' },
      'X'
    ),
    proposed: statusMap(
      { LC: 'P', GC: 'P', LI: 'P', GI: 'P', HI: 'P', 'DB-2': 'P', DC: 'CUP' },
      'X'
    ),
    currentNote:
      'Today (Section 11-86-4): passenger transportation, local delivery, medical ' +
      'transport and similar businesses relying on fleets of 3 or more vehicles ' +
      'with rated capacities under 10,000 lbs. Permitted in GC, LI, GI, HI and ' +
      'DB-2; allowed in DC with a Council Use Permit.',
    proposedNote:
      'Proposed: redefined as a Fleet-Based Service of ground- or aerial-based ' +
      'vehicles under 10,000 lbs, involving no more than 50 vehicles and less than ' +
      '10,000 sq ft of fleet area. Added to the LC (Limited Commercial) District as ' +
      'permitted. New development standards in Section 11-31-40 apply (designated ' +
      'fleet areas, screening walls, 100-ft residential separation for equipment).',
    changeSummary: [
      { kind: 'new-p', text: 'LC — newly Permitted (was not allowed)' },
      { kind: 'same', text: 'GC, LI, GI, HI, DB-2 — remain Permitted' },
      { kind: 'same', text: 'DC — still requires a Council Use Permit (CUP)' },
      { kind: 'std', text: 'New Section 11-31-40 development standards apply everywhere the use is allowed' },
    ],
  },

  heavyFleet: {
    short: 'Heavy Fleet',
    name: 'Heavy Fleet-Based Services',
    badge: 'New use classification',
    tagline:
      'Larger fleet operations: any vehicle rated 10,000 lbs or more, OR more ' +
      'than 50 vehicles, OR 10,000+ sq ft of dedicated fleet area.',
    currentUndefined: true,
    current: statusMap({}, 'ND'),
    proposed: statusMap({ GC: 'CUP', LI: 'CUP', GI: 'P', HI: 'P' }, 'X'),
    currentNote:
      'Today: "Heavy Fleet-Based Services" does not exist in the code. Larger ' +
      'fleet operations have no tailored classification or standards — they must ' +
      'be interpreted under other use categories case by case.',
    proposedNote:
      'Proposed: permitted by right in GI and HI; allowed in GC and LI only with a ' +
      'Council Use Permit — reflecting greater traffic, noise and compatibility ' +
      'impacts. Section 11-31-40 development standards apply. (The CUP option for ' +
      'LI was added after stakeholder outreach.)',
    changeSummary: [
      { kind: 'new-p', text: 'GI, HI — newly Permitted by right' },
      { kind: 'new-cup', text: 'GC, LI — newly allowed with a Council Use Permit (CUP)' },
      { kind: 'same', text: 'All other districts — not permitted' },
      { kind: 'std', text: 'Section 11-31-40: designated fleet areas, masonry screening, 100-ft residential separation' },
    ],
  },

  accFleet: {
    short: 'Accessory Fleet',
    name: 'Accessory Fleet-Based Services',
    badge: 'New use classification',
    tagline:
      'A fleet operation that is incidental and subordinate to a principal use on ' +
      'the same lot, serving only that use (e.g., a store’s own delivery fleet).',
    currentUndefined: true,
    current: statusMap({}, 'ND'),
    proposed: statusMap(
      { LC: 'P', GC: 'P', PEP: 'P', LI: 'P', GI: 'P', HI: 'P', 'DB-2': 'P', DC: 'P' },
      'X'
    ),
    currentNote:
      'Today: no accessory fleet classification exists, so businesses that keep a ' +
      'fleet as part of a larger operation lack clear rules.',
    proposedNote:
      'Proposed: permitted as an accessory use in LC, GC, PEP, LI, GI, HI, DB-2 ' +
      'and DC. Key limits (Sections 11-86-4 and 11-31-40): may not be the principal ' +
      'use, may not serve off-site businesses, may occupy no more than 50% of the ' +
      'required parking for the principal use, and fleet vehicles must be kept to ' +
      'the side or rear of buildings — never between the front façade and the street.',
    changeSummary: [
      { kind: 'new-p', text: 'LC, GC, PEP, LI, GI, HI, DB-2, DC — newly Permitted as an accessory use' },
      { kind: 'std', text: 'Limited to 50% of required parking; side/rear placement only' },
      { kind: 'std', text: 'Must stay subordinate in area to the principal use' },
    ],
  },

  accEV: {
    short: 'Accessory EV Charging',
    name: 'Accessory Electric Vehicle Charging',
    badge: 'New use classification',
    tagline:
      'EV charging equipment inside an on-site parking lot or structure, ' +
      'incidental and subordinate to the principal use of the site.',
    currentUndefined: true,
    current: statusMap({}, 'ND'),
    proposed: statusMap(
      {
        NC: 'PF', LC: 'PF', GC: 'PF', OC: 'PF', MX: 'PF',
        PEP: 'PF', LI: 'PF', GI: 'PF', HI: 'PF',
        'DB-1': 'PF', 'DB-2': 'PF', DC: 'PF',
      },
      'X'
    ),
    currentNote:
      'Today: the code does not expressly classify EV charging placed in a ' +
      'parking lot as an accessory use, leaving approval pathways unclear.',
    proposedNote:
      'Proposed: permitted in every commercial, employment and downtown business ' +
      'district (NC, LC, GC, OC, MX, PEP, LI, GI, HI, DB-1, DB-2, DC), subject to ' +
      'two footnotes: charging spaces may occupy no more than 20% of required ' +
      'parking (more if a parking study shows excess supply), and any required ' +
      'landscaping removed for charging equipment must be replaced on site.',
    footnote:
      '* Footnotes: max 20% of required on-site parking unless a parking study ' +
      'demonstrates excess capacity; displaced required landscaping must be ' +
      'replaced elsewhere on the site.',
    changeSummary: [
      { kind: 'new-p', text: 'NC, LC, GC, OC, MX, PEP, LI, GI, HI, DB-1, DB-2, DC — newly Permitted (with footnotes)' },
      { kind: 'std', text: 'Capped at 20% of required parking, unless a parking study shows excess spaces' },
      { kind: 'std', text: 'Required landscaping removed for EVSE must be replaced on site' },
    ],
  },

  serviceStations: {
    short: 'Service Stations',
    name: 'Service Stations',
    badge: 'Definition & standards updated',
    standardsOnly: true,
    tagline:
      'Gas, diesel and now EV-charging stations serving the general public. This ' +
      'amendment updates the definition and site standards — it does NOT change ' +
      'which zoning districts allow service stations.',
    current: statusMap({}, 'X'),
    proposed: statusMap({}, 'X'),
    currentNote: '',
    proposedNote: '',
    currentStandards: [
      'Definition covers retailing automotive fuels (gasoline/diesel); electricity is not addressed',
      'Max 2 stations per arterial intersection; 100 ft of street frontage',
      'Pump islands covered by a canopy that complements the main structure (no height/fascia limits)',
      'Shielded, downward-directed exterior lighting (general rule only)',
      'Masonry fencing; 10% of site landscaped',
      'No queuing/stacking standards',
      'No residential separation distance for pumps',
      'Trash receptacle at each pump island',
    ],
    proposedStandards: [
      'Definition now includes dispensing electricity via EVSE; excludes dedicated fleet fueling/charging; allows minor (not major) vehicle servicing',
      'Max 2 stations per arterial intersection; 100 ft of frontage on each street (unchanged intent, clarified)',
      'Canopy: max 16-ft clearance height, max 30-inch fascia, colors/materials must match the primary building',
      'Canopy lights recessed & flush-mounted; max 20 footcandles within 150 ft of residential',
      'EV charging may use solar canopies, shade structures or trellises instead of a fuel-style canopy',
      'New stacking standards: 20 ft on both sides of each pump island; 36 ft of approach stacking for one-way circulation',
      'New: 100-ft separation between pumps/chargers and any residential use or residential district (RS, RSL, RM) — Planning Director may reduce with a sound study (≤60 dB at the property line)',
      'Trash receptacle per every 4 fueling/charging positions',
    ],
    changeSummary: [
      { kind: 'std', text: 'Definition modernized to include EV charging; fleet-dedicated fueling/charging excluded' },
      { kind: 'std', text: 'New canopy, lighting, stacking and residential-separation standards (Section 11-31-25)' },
      { kind: 'same', text: 'District permissions in the land-use tables are NOT changed by this amendment' },
    ],
  },
};

const USE_ORDER = ['lightFleet', 'heavyFleet', 'accFleet', 'accEV', 'serviceStations'];

const STATUS_META = {
  P:   { label: 'Permitted',                short: 'P' },
  PF:  { label: 'Permitted (see footnotes)', short: 'P *' },
  CUP: { label: 'Council Use Permit required', short: 'CUP' },
  X:   { label: 'Not permitted',            short: '—' },
  ND:  { label: 'Not a defined use in today’s code', short: 'n/a' },
};

/* Change classification between scenarios, for the "What changes" view. */
function classifyChange(cur, pro) {
  const allowedCur = cur === 'P' || cur === 'PF' || cur === 'CUP';
  const allowedPro = pro === 'P' || pro === 'PF' || pro === 'CUP';
  if (!allowedCur && (pro === 'P' || pro === 'PF')) return 'NEW_P';
  if (!allowedCur && pro === 'CUP') return 'NEW_CUP';
  if (allowedCur && !allowedPro) return 'REMOVED';       // not used by this amendment
  if (allowedCur && allowedPro) {
    if (cur === 'CUP' && pro === 'CUP') return 'SAME_CUP';
    return 'SAME_ALLOWED';
  }
  return 'SAME_NO';
}

window.MesaRules = {
  DISTRICT_GROUPS,
  DISTRICT_NAMES,
  TABLE_DISTRICTS,
  USES,
  USE_ORDER,
  STATUS_META,
  classifyChange,
};
