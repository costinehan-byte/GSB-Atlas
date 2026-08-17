/**
 * Resolves a latitude/longitude for every school in the workbook.
 *
 * The source workbook has no coordinate columns — only addresses and a
 * "straight-line km from Canggu" figure derived from Google Places geocodes.
 * That distance column is the key to doing this safely: it lets every candidate
 * returned by Nominatim be checked against a known-good answer. A candidate is
 * only accepted when its own distance from Canggu agrees with the workbook, so a
 * geocoder hit on the wrong "Montessori School" somewhere else in Bali is
 * rejected rather than silently plotted.
 *
 *   npm run geocode          # fill in anything missing from the cache
 *   npm run geocode -- --force   # re-resolve everything from scratch
 *
 * Results are cached in data/geocode-cache.json so the ETL is reproducible
 * offline and re-runs cost no network calls. Anything the geocoder cannot place
 * confidently can be corrected by hand in data/geocode-overrides.json, which
 * always wins.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readWorkbook, splitName } from "./lib/workbook.js";
import {
  isInBali,
  kmFromCanggu,
  snapToRecordedDistance,
  type LatLng,
} from "./lib/geo.js";
import type { GeoConfidence } from "../src/lib/types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DATA = path.join(ROOT, "data");

const WORKBOOK = path.join(DATA, "Bali_International_Schools_Competitive_Landscape.xlsx");
const CACHE_PATH = path.join(DATA, "geocode-cache.json");
const OVERRIDES_PATH = path.join(DATA, "geocode-overrides.json");

/** Nominatim's usage policy requires an identifying UA and <=1 request/second. */
const USER_AGENT = "bali-schools-dashboard/1.0 (competitive landscape build script)";
const RATE_LIMIT_MS = 1100;

/**
 * Accepted disagreement between a candidate's distance-from-Canggu and the
 * workbook's figure, per kind of query. Both are straight-line kilometres.
 *
 * Name queries are held to a tight tolerance on purpose. A loose gate lets
 * through unrelated businesses that merely share an acronym and happen to sit a
 * plausible distance from Canggu — searching "ACS Bali" returns an airline
 * catering depot 2.7km off the recorded figure. If a name match is not close,
 * it is not a match, and the address and locality queries should get their turn.
 */
const TOLERANCE_KM: Record<GeoConfidence, number> = {
  exact: 1.5,
  approximate: 4,
  area: 6,
};

export interface GeocodeEntry {
  lat: number;
  lng: number;
  confidence: GeoConfidence;
  /** Human-readable provenance, e.g. the query and matched display name. */
  source: string;
  /** |candidate distance from Canggu − workbook distance|, in km. */
  deltaKm: number;
  resolvedAt: string;
}

type Cache = Record<string, GeocodeEntry>;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
}

/* ------------------------------------------------------------------- io -- */

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    console.warn(`  ! could not parse ${path.basename(file)}: ${String(error)}`);
    return fallback;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* -------------------------------------------------------------- queries -- */

/** Trims an address down to something a geocoder can actually match. */
function addressQuery(address: string): string {
  // Multi-campus rows list several addresses; the first is the primary campus.
  const primary = address.split(/;|&(?=\s*[A-Z])/)[0];
  return primary
    .replace(/\b(No\.?|Gg\.?)\s*[\w.-]+/gi, "") // house/alley numbers confuse Nominatim
    .replace(/\b\d{5}\b/g, "") // postcodes
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(^[,\s]+|[,\s]+$)/g, "");
}

/**
 * Locality queries for an area string, most specific first.
 *
 * "Kura Kura Bali SEZ, Serangan, Denpasar Selatan" is too specific for
 * Nominatim as a whole, so progressively broader suffixes are tried —
 * "Serangan, Denpasar Selatan", then "Denpasar Selatan" — until something
 * resolves. The bearing of a broader locality is still enough to place the
 * school once its radius is snapped to the recorded distance.
 */
function areaQueries(area: string): string[] {
  const cleaned = area
    .replace(/\([^)]*\)/g, "")
    .split("&")[0]
    .split("/")[0]
    .replace(/\bSEZ\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[,\s]+$/, "");

  const parts = cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // ["A, B, C", "B, C", "C"]
  return parts.map((_, i) => parts.slice(i).join(", ")).filter(Boolean);
}

/**
 * Ordered candidate queries, most specific first. Each is tried until one
 * produces a result that passes the distance check.
 */
function buildQueries(row: {
  name: string;
  area: string;
  address: string;
}): { query: string; kind: GeoConfidence }[] {
  const { name } = splitName(row.name);
  const bare = name.replace(/\([^)]*\)/g, "").trim();
  const areas = areaQueries(row.area);

  const queries: { query: string; kind: GeoConfidence }[] = [
    { query: `${bare}, Bali, Indonesia`, kind: "exact" },
    { query: `${bare}, ${areas[0]}, Bali, Indonesia`, kind: "exact" },
    { query: `${addressQuery(row.address)}, Bali, Indonesia`, kind: "approximate" },
    ...areas.map((area) => ({ query: `${area}, Bali, Indonesia`, kind: "area" as const })),
  ];

  // De-duplicate while preserving the strongest kind for each distinct query.
  const seen = new Set<string>();
  return queries.filter(({ query }) => {
    const key = query.toLowerCase();
    if (seen.has(key) || key.length < 12) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------------------------------------------ nominatim -- */

async function search(query: string): Promise<NominatimResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "id");
  // Constrain to Bali so same-named places elsewhere never enter the running.
  url.searchParams.set("viewbox", "114.40,-8.02,115.75,-8.95");
  url.searchParams.set("bounded", "1");

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Nominatim ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as NominatimResult[];
}

/* ------------------------------------------------------------- resolver -- */

interface Candidate {
  point: LatLng;
  deltaKm: number;
  display: string;
}

/**
 * Picks the in-Bali candidate whose distance from Canggu best agrees with the
 * workbook. Returns the best candidate regardless of tolerance; the caller
 * decides whether it is close enough for the query that produced it.
 */
function bestCandidate(results: NominatimResult[], expectedKm: number): Candidate | null {
  let best: Candidate | null = null;

  for (const result of results) {
    const point: LatLng = { lat: Number(result.lat), lng: Number(result.lon) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    if (!isInBali(point)) continue;

    const deltaKm = Math.abs(kmFromCanggu(point) - expectedKm);
    if (best === null || deltaKm < best.deltaKm) {
      best = { point, deltaKm, display: result.display_name };
    }
  }

  return best;
}

function makeEntry(
  candidate: Candidate,
  confidence: GeoConfidence,
  query: string,
  recordedKm: number,
): GeocodeEntry {
  // Locality-level hits are snapped onto the recorded radius; precise campus
  // hits are already correct and are left exactly where the geocoder put them.
  const snapped = confidence === "area";
  const point = snapped
    ? snapToRecordedDistance(candidate.point, recordedKm)
    : candidate.point;

  const provenance = snapped
    ? `Nominatim/OSM locality "${query}" → ${candidate.display}; bearing kept, ` +
      `radius snapped to the workbook's ${recordedKm}km from Canggu`
    : `Nominatim/OSM · "${query}" → ${candidate.display}`;

  return {
    lat: Number(point.lat.toFixed(6)),
    lng: Number(point.lng.toFixed(6)),
    confidence,
    source: provenance,
    deltaKm: Number((snapped ? 0 : candidate.deltaKm).toFixed(3)),
    resolvedAt: new Date().toISOString(),
  };
}

async function resolveSchool(row: {
  name: string;
  area: string;
  address: string;
  straightLineKm: number;
}): Promise<GeocodeEntry | null> {
  // Remembered in case every gated query fails and we need a bearing to snap.
  let fallback: { candidate: Candidate; query: string } | null = null;

  for (const { query, kind } of buildQueries(row)) {
    await sleep(RATE_LIMIT_MS);

    let results: NominatimResult[];
    try {
      results = await search(query);
    } catch (error) {
      console.warn(`    ! ${String(error)} for "${query}"`);
      continue;
    }

    const candidate = bestCandidate(results, row.straightLineKm);
    if (!candidate) continue;

    if (kind === "area" && fallback === null) fallback = { candidate, query };

    if (candidate.deltaKm > TOLERANCE_KM[kind]) {
      console.log(
        `    · rejected ${kind} match Δ${candidate.deltaKm.toFixed(2)}km  ` +
          `${candidate.display.slice(0, 55)}`,
      );
      continue;
    }

    const entry = makeEntry(candidate, kind, query, row.straightLineKm);
    console.log(
      `    ✓ ${kind.padEnd(11)} Δ${candidate.deltaKm.toFixed(2)}km  ${candidate.display.slice(0, 66)}`,
    );
    return entry;
  }

  // Nothing passed its gate. If a locality was found at all, its direction from
  // Canggu is still good information — combine it with the recorded distance.
  if (fallback) {
    console.log(
      `    ✓ area (snapped) from ${fallback.candidate.display.slice(0, 55)} ` +
        `(centroid was Δ${fallback.candidate.deltaKm.toFixed(2)}km)`,
    );
    return makeEntry(fallback.candidate, "area", fallback.query, row.straightLineKm);
  }

  return null;
}

/* ----------------------------------------------------------------- main -- */

async function main() {
  const force = process.argv.includes("--force");

  const { rows } = await readWorkbook(WORKBOOK);
  const cache = force ? {} : await readJson<Cache>(CACHE_PATH, {});
  const overrides = await readJson<Record<string, GeocodeEntry>>(OVERRIDES_PATH, {});

  console.log(
    `Geocoding ${rows.length} schools (${Object.keys(cache).length} cached, ` +
      `${Object.keys(overrides).length} manual overrides)\n`,
  );

  const unresolved: string[] = [];

  for (const row of rows) {
    if (overrides[row.name]) continue; // hand-corrected; never re-queried
    if (cache[row.name]) continue;

    console.log(`  ${row.name}  (expect ${row.straightLineKm}km from Canggu)`);
    const entry = await resolveSchool(row);

    if (entry) {
      cache[row.name] = entry;
      await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");
    } else {
      console.log("    ✗ no candidate passed the distance check");
      unresolved.push(row.name);
    }
  }

  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");

  const resolved = rows.filter((r) => cache[r.name] || overrides[r.name]);
  const byConfidence = resolved.reduce<Record<string, number>>((acc, r) => {
    const entry = overrides[r.name] ?? cache[r.name];
    acc[entry.confidence] = (acc[entry.confidence] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nResolved ${resolved.length}/${rows.length}`);
  for (const [confidence, count] of Object.entries(byConfidence)) {
    console.log(`  ${confidence.padEnd(12)} ${count}`);
  }

  if (unresolved.length > 0) {
    console.log(
      `\n${unresolved.length} unresolved — add coordinates to ` +
        `data/geocode-overrides.json keyed by school name:`,
    );
    for (const name of unresolved) console.log(`  · ${name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
