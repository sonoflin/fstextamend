# Mesa Zoning Text Amendment Map — Fleet-Based Services & Service Stations

An interactive, presentation-ready map of the City of Mesa's proposed
**Fleet-Based Services & Service Stations zoning text amendment**
(Mesa City Code Title 11, Chapters 6, 7, 8, 31 and 86).

For each affected use classification, the map shows — district by district —
what the code allows **today**, what the **proposed amendment** would allow,
and a **"What Changes"** delta view, with Council Use Permit (CUP)
requirements clearly distinguished. City Council districts can be overlaid.

## Views

| Use classification | What the amendment does |
|---|---|
| **Light Fleet-Based Services** | Definition revised (adds aerial/drone fleets, 50-vehicle & 10,000 sq ft thresholds); newly permitted in **LC** |
| **Heavy Fleet-Based Services** | **New classification** — permitted in GI & HI; CUP in GC & LI |
| **Accessory Fleet-Based Services** | **New classification** — permitted in LC, GC, PEP, LI, GI, HI, DB-2, DC |
| **Accessory EV Charging** | **New classification** — permitted (with footnote limits) in NC, LC, GC, OC, MX, PEP, LI, GI, HI, DB-1, DB-2, DC |
| **Service Stations** | Definition & development standards modernized (EV charging, canopy, lighting, stacking, 100-ft residential separation) — allowed districts unchanged |

## Data

- **Ordinance content** is encoded in [`js/rules.js`](js/rules.js), transcribed
  from Exhibit 1 (ordinance) and Exhibit 2 (Section 11-31-40) of the
  June 24, 2026 Planning & Zoning Board staff report. If the amendment is
  revised before adoption, update that one file.
- **Zoning district polygons** and **council district boundaries** load live
  in the browser from [City of Mesa GIS](https://opengis.mesaaz.gov/)
  ArcGIS REST services, so the map always reflects current adopted zoning.
  The verified endpoints (with fallbacks) are configured in
  [`js/data.js`](js/data.js):
  - Zoning (~8,000 parcels):
    `https://gis.mesaaz.gov/mesaaz/rest/services/Planning/ZoningOverlay/MapServer/1`
    (`Zoning` / `Description` fields)
  - Council districts (6):
    `https://gis.mesaaz.gov/mesaaz/rest/services/BaseMap/MesaDistricts/MapServer/2`
    (`DISTRICT` field)
- **Basemap**: CARTO Positron tiles (© OpenStreetMap contributors, © CARTO).

No build step — plain HTML/CSS/JS with a vendored copy of
[Leaflet](https://leafletjs.com/) 1.9.4.

## Hosting on GitHub Pages

This is a plain static site (no build step). It publishes automatically via
GitHub Actions — the workflow in
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
enables Pages on its first run (build type **GitHub Actions**) and deploys on
every push to the default branch, so **no manual Settings step is required**.

GitHub serves the site at `https://<owner>.github.io/fstextamend/`
(here, https://sonoflin.github.io/fstextamend/). The included `.nojekyll`
file tells Pages to serve all directories as-is.

All asset paths in `index.html` are relative, so the site works correctly
under the `/fstextamend/` sub-path.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000            (live Mesa GIS data)
# open http://localhost:8000/?demo=1    (synthetic fixture, works offline)
```

Shareable state is kept in the URL hash, e.g.
`#use=heavyFleet&view=changes` — handy for stepping through views like
slides during a presentation.

## Accuracy notes

- Statuses are transcribed from the amended land-use tables in Exhibit 1
  (Tables 11-6-2, 11-7-2, 11-8-2). The staff report's narrative summary
  omits OC for Accessory EV Charging, but the ordinance table shows `P` in
  all five commercial districts including OC; this map follows the ordinance
  table.
- Overlay districts (PAD, BIZ, etc.) and site-specific conditions are not
  represented; polygons are colored by their base district.
- This is an unofficial visualization for public engagement. Where it and
  the ordinance text differ, the ordinance governs.
