# Bali International Schools — Competitive Landscape

An interactive map and analytics dashboard covering the 38 international and
national-plus schools operating in Bali, built for a competitive review of Green
School Bali's position.

Everything derives from a single source workbook,
`data/Bali_International_Schools_Competitive_Landscape.xlsx`. Nothing in the UI
is hand-entered.

## Quick start

```bash
npm install
npm run dev
```

The generated data is committed, so the app runs without re-running the ETL.

## Stack

- **Vite + React 19 + TypeScript** (strict)
- **Tailwind v4 + shadcn/ui** — theme tokens in `src/index.css`
- **Leaflet + react-leaflet** with OpenStreetMap tiles via CARTO (Positron in
  light mode, Dark Matter in dark)
- **Recharts** for the analytics
- **SQLite** (`better-sqlite3`) as the canonical data artefact

## Deployment

```bash
docker compose up -d --build   # http://localhost:8080
```

Or without compose:

```bash
docker build -t bali-schools-dashboard:latest .
docker run -d --name bali-schools-dashboard \
  --read-only --tmpfs /tmp \
  -p 8080:8080 \
  bali-schools-dashboard:latest
```

Multi-stage build: Node 24 compiles the bundle, nginx 1.29-alpine serves it.
Final image is ~63MB and contains no build toolchain.

**For whoever deploys it:**

- Listens on **8080**, not 80 — it runs as **uid 101**, so it never needs a
  privileged port or root.
- Runs on a **read-only root filesystem**. The only writable mount it needs is
  a tmpfs at `/tmp`, where nginx keeps its pid and scratch files. Everything is
  baked in; there are no volumes and no persistent state.
- **No environment variables, no config, no backend.** The dataset is compiled
  into the bundle at build time.
- Health endpoint at **`/healthz`** (also wired into `HEALTHCHECK`).
- TLS and HSTS are expected to terminate at your reverse proxy; the image sets
  the other security headers itself.
- The **only off-origin request is map tiles** from
  `*.basemaps.cartocdn.com`, and the CSP is scoped to allow exactly that. The
  container needs outbound HTTPS for tiles to render — everything else works
  offline.

The ETL deliberately does **not** run during the image build. It needs the
source workbook and a populated geocode cache, and re-running it on deploy
would let a rebuild silently change the data. The committed dataset is what
ships.

## Data pipeline

```
Bali_..._Landscape.xlsx
        │
        ├── npm run geocode ──▶ data/geocode-cache.json
        │
        └── npm run etl ──┬──▶ data/schools.db              (canonical SQLite)
                          └──▶ src/data/dataset.generated.ts (typed, imported by the UI)
```

`data/schools.db` is a normal SQLite file — open it with any client and query it
directly, independently of this app:

```sql
SELECT name, fee_high_idr / 1e6 AS fee_mm, drive_minutes
  FROM schools
 WHERE tier_group = 'tier1'
 ORDER BY fee_mm DESC;

-- Mirrors the workbook's own Fee Benchmark sheet
SELECT * FROM tier1_fee_benchmark;
```

Tables: `schools`, `school_curriculum_tags`, `school_languages`,
`school_sources`, `meta`, plus the `tier1_fee_benchmark` view.

The UI reads the generated TypeScript module rather than the database, so the
dashboard ships as a fully static bundle with no database driver or WASM in the
browser. The two are always built together from the same run.

### Regenerating

```bash
npm run geocode   # only needed for new/changed schools; results are cached
npm run etl       # rebuilds schools.db and dataset.generated.ts
```

`npm run etl` validates as it goes and exits non-zero on problems: coordinates
outside Bali, mapped positions that disagree with the workbook's recorded
distance, fee ranges that invert, untagged curricula, and markers that would
land on top of each other.

## About the coordinates

The workbook has addresses but **no latitude/longitude**, so positions are
geocoded from OpenStreetMap. Geocoding school names is error-prone — searching
"ACS Bali" returns an airline catering depot, "Spark Bali" a dive resort 45km
away — so every candidate is checked against the workbook's own "straight-line
km from Canggu" column and rejected if the two disagree.

Each school is therefore mapped at one of three confidence levels, shown in its
profile panel and summarised under Methodology:

| Level | Meaning | Count |
|---|---|---:|
| `exact` | Matched to the school's own address | 8 |
| `approximate` | Matched to the school's street | 3 |
| `area` | Matched to the locality, then placed at the workbook's recorded distance from Canggu | 27 |

Locality-level positions carry the right *direction* from Canggu and the right
*distance*, but not the campus gate. Two schools sharing a locality and a
distance are fanned 130m apart so both stay clickable — a spread well inside the
uncertainty the `area` level already declares.

**This is planning-grade geography, not survey-grade.** Verify any address
directly before acting on it.

## Design notes

Competitive tier is an ordinal scale, so it is encoded as a single-hue ramp
(darkest = strongest threat) rather than arbitrary categorical colours, with
marker size carrying the same information redundantly. Green School Bali sits
outside that scale — it is the subject, not a threat level — so it has its own
hue. Both ramps were validated for lightness monotonicity, step separation and
colour-vision-deficiency safety against their own surfaces, and the dark ramp is
re-stepped for dark tiles rather than flipped.

Distribution charts that show a single measure use one colour: the category is
already named on the axis, so a second colour channel would encode nothing.

## Caveats carried from the source

- Fees are as published for the stated academic year and reset annually. Ten of
  38 schools publish none at all.
- Enrollment is disclosed by only 5 of 38 schools; the rest are genuinely
  unknown, not estimated.
- Drive times are the workbook's planning-level estimates for typical daytime
  traffic — add 30–50% at rush hour.
- USD figures are the workbook's approximations at IDR 17,800 = USD 1. No school
  quotes in USD.
