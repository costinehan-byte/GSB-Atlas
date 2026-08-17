/**
 * Builds the dashboard's data artefacts from the source workbook.
 *
 *   Excel  ──▶  data/schools.db                 (canonical, queryable SQLite)
 *          └─▶  src/data/dataset.generated.ts   (typed module the UI imports)
 *
 * The SQLite database is the durable artefact — anyone can open it and run SQL
 * against the landscape without touching this app. The generated TypeScript
 * module is a build product of it, so the dashboard ships as a fully static
 * bundle with no database driver or WASM in the browser.
 *
 *   npm run etl
 *
 * Coordinates come from data/geocode-cache.json (see scripts/geocode.ts).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import {
  readWorkbook,
  slugify,
  splitName,
  parseTier,
  parseRegency,
  parseCatchment,
  parseCurriculumTags,
  parseMediumOfInstruction,
  parseEnrollment,
  parseAgeRange,
  parseSources,
} from "./lib/workbook.js";
import { CANGGU, destination, isInBali, kmFromCanggu } from "./lib/geo.js";
import type { GeocodeEntry } from "./geocode.js";
import type { Dataset, Meta, School } from "../src/lib/types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DATA = path.join(ROOT, "data");

const WORKBOOK = path.join(DATA, "Bali_International_Schools_Competitive_Landscape.xlsx");
const CACHE_PATH = path.join(DATA, "geocode-cache.json");
const OVERRIDES_PATH = path.join(DATA, "geocode-overrides.json");
const DB_PATH = path.join(DATA, "schools.db");
const OUT_TS = path.join(ROOT, "src", "data", "dataset.generated.ts");

const DEFAULT_IDR_PER_USD = 17800;

/* ------------------------------------------------------------------ meta -- */

/**
 * Pulls provenance out of the Overview sheet by looking for its section
 * headings rather than fixed row numbers, so inserting a row upstream does not
 * silently shift the wrong text into the About panel.
 */
function parseMeta(overview: string[][]): Omit<Meta, "generatedAt" | "canggu"> {
  const lines = overview.map((row) => row.filter(Boolean));
  const flat = lines.map((cells) => cells[0] ?? "");

  const findIndex = (pattern: RegExp) => flat.findIndex((t) => pattern.test(t));
  const find = (pattern: RegExp) => flat.find((t) => pattern.test(t)) ?? "";

  const purposeAt = findIndex(/^Purpose$/i);
  const purpose = purposeAt >= 0 ? (flat[purposeAt + 1] ?? "") : "";

  const tierDefinitions = lines
    .filter((cells) => cells.length >= 2 && /^Tier\s*\d/i.test(cells[0]))
    .map((cells) => ({ label: cells[0], definition: cells[1] }));

  const methodology = flat
    .filter((t) => t.startsWith("•"))
    .map((t) => t.replace(/^•\s*/, ""));

  const rateMatch = methodology
    .join(" ")
    .match(/IDR\s*([\d,]+)\s*=\s*USD\s*1/i);
  const idrPerUsd = rateMatch
    ? Number(rateMatch[1].replace(/,/g, ""))
    : DEFAULT_IDR_PER_USD;

  return {
    title: flat[0] ?? "Bali International Schools — Competitive Landscape",
    preparedFor: find(/^Prepared for/i).replace(/^Prepared for\s*/i, ""),
    compiled: find(/^Compiled:/i).replace(/^Compiled:\s*/i, ""),
    purpose,
    tierDefinitions,
    methodology,
    idrPerUsd,
  };
}

/* --------------------------------------------------------------- schools -- */

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function buildSchools(): Promise<{ schools: School[]; meta: Meta }> {
  const { rows, overview } = await readWorkbook(WORKBOOK);

  const cache = await readJson<Record<string, GeocodeEntry>>(CACHE_PATH, {});
  const overrides = await readJson<Record<string, GeocodeEntry>>(OVERRIDES_PATH, {});

  const missing = rows.filter((r) => !overrides[r.name] && !cache[r.name]);
  if (missing.length > 0) {
    throw new Error(
      `No coordinates for ${missing.length} school(s): ${missing
        .map((r) => r.name)
        .join(", ")}.\nRun "npm run geocode" first.`,
    );
  }

  const schools = rows.map((row): School => {
    const { name, shortName } = splitName(row.name);
    const tier = parseTier(row.tier);
    const enrollment = parseEnrollment(row.enrollment);
    const ages = parseAgeRange(row.gradeRange);
    const geo = overrides[row.name] ?? cache[row.name];

    return {
      id: slugify(row.name),
      name,
      shortName,

      tierLabel: row.tier,
      tierGroup: tier.group,
      tierNote: tier.note,

      area: row.area,
      regency: parseRegency(row.area),
      catchment: parseCatchment(row.area, row.driveMinutes),
      address: row.address,

      curriculum: row.curriculum,
      curriculumTags: parseCurriculumTags(row.curriculum),

      languages: row.languages,
      mediumOfInstruction: parseMediumOfInstruction(row.languages),

      gradeRange: row.gradeRange,
      ageMin: ages.min,
      ageMax: ages.max,

      enrollmentRaw: row.enrollment,
      enrollment: enrollment.value,
      enrollmentDisclosed: enrollment.disclosed,

      feeLowIdr: row.feeLowIdr,
      feeHighIdr: row.feeHighIdr,
      feeLowUsd: row.feeLowUsd,
      feeHighUsd: row.feeHighUsd,
      feeNote: row.feeNote,
      feePublished: row.feeLowIdr !== null && row.feeHighIdr !== null,

      straightLineKm: row.straightLineKm,
      roadKm: row.roadKm,
      driveMinutes: row.driveMinutes,

      notes: row.notes,
      sources: parseSources(row.sources),

      lat: geo.lat,
      lng: geo.lng,
      geoConfidence: geo.confidence,
      geoSource: geo.source,

      whyItCompetes: row.whyItCompetes,
      keyWatchOut: row.keyWatchOut,
    };
  });

  const meta: Meta = {
    ...parseMeta(overview),
    canggu: CANGGU,
    generatedAt: new Date().toISOString(),
  };

  return { schools, meta };
}

/* ------------------------------------------------------------- collision -- */

/** Great-circle separation in metres, adequate at these short distances. */
function metresBetween(a: School, b: School): number {
  return (
    Math.hypot(
      (a.lat - b.lat) * 111,
      (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180),
    ) * 1000
  );
}

const COLLISION_THRESHOLD_M = 120;
const SEPARATION_RADIUS_KM = 0.13;

/**
 * Fans out markers that would otherwise land on the same pixel.
 *
 * Two schools in the same village with the same recorded distance from Canggu
 * resolve to the identical point — Sunrise School Bali and Bhumi Bali School are
 * both "Kerobokan, 4.4km". Neither has a precise coordinate to fall back on, so
 * they are spread evenly around a 130m circle: far enough apart to be separately
 * clickable, well inside the uncertainty their "area" confidence already
 * declares. Schools resolved to their actual campus never move.
 */
function separateCollisions(schools: School[]): string[] {
  const moved: string[] = [];
  const claimed = new Set<string>();

  for (const school of schools) {
    if (claimed.has(school.id)) continue;

    const cluster = schools.filter(
      (other) => !claimed.has(other.id) && metresBetween(school, other) < COLLISION_THRESHOLD_M,
    );
    for (const member of cluster) claimed.add(member.id);
    if (cluster.length < 2) continue;

    const centre = { lat: school.lat, lng: school.lng };
    // Sorted by id so the layout is stable across rebuilds.
    const movable = cluster
      .filter((s) => s.geoConfidence !== "exact")
      .sort((a, b) => a.id.localeCompare(b.id));

    movable.forEach((member, index) => {
      const bearing = (2 * Math.PI * index) / movable.length;
      const point = destination(centre, bearing, SEPARATION_RADIUS_KM);

      member.lat = Number(point.lat.toFixed(6));
      member.lng = Number(point.lng.toFixed(6));
      member.geoSource +=
        `; offset ${Math.round(SEPARATION_RADIUS_KM * 1000)}m to separate it from ` +
        `${cluster.length - 1} co-located school(s)`;

      moved.push(member.name);
    });
  }

  return moved;
}

/* -------------------------------------------------------------- validate -- */

/** Reports data problems that would show up as a visibly wrong dashboard. */
function validate(schools: School[]): string[] {
  const problems: string[] = [];

  const ids = new Set<string>();
  for (const s of schools) {
    if (ids.has(s.id)) problems.push(`duplicate id "${s.id}"`);
    ids.add(s.id);

    if (!isInBali({ lat: s.lat, lng: s.lng })) {
      problems.push(`${s.name}: coordinate falls outside Bali`);
    }

    const delta = Math.abs(kmFromCanggu({ lat: s.lat, lng: s.lng }) - s.straightLineKm);
    if (delta > 4) {
      problems.push(
        `${s.name}: mapped position is ${delta.toFixed(1)}km from the recorded ` +
          `${s.straightLineKm}km from Canggu`,
      );
    }

    if (s.feeLowIdr !== null && s.feeHighIdr !== null && s.feeLowIdr > s.feeHighIdr) {
      problems.push(`${s.name}: fee low exceeds fee high`);
    }
    if (s.curriculumTags.length === 0) {
      problems.push(`${s.name}: no curriculum tags derived from "${s.curriculum}"`);
    }
    if (s.driveMinutes <= 0) problems.push(`${s.name}: missing drive time`);
  }

  // Markers closer than ~80m are indistinguishable at any usable zoom.
  for (let i = 0; i < schools.length; i++) {
    for (let j = i + 1; j < schools.length; j++) {
      const metres = metresBetween(schools[i], schools[j]);
      if (metres < 80) {
        problems.push(
          `${schools[i].name} and ${schools[j].name} sit ${metres.toFixed(0)}m apart on the map`,
        );
      }
    }
  }

  return problems;
}

/* ---------------------------------------------------------------- sqlite -- */

const SCHEMA = `
DROP TABLE IF EXISTS school_curriculum_tags;
DROP TABLE IF EXISTS school_languages;
DROP TABLE IF EXISTS school_sources;
DROP TABLE IF EXISTS schools;
DROP TABLE IF EXISTS meta;
DROP VIEW IF EXISTS tier1_fee_benchmark;

CREATE TABLE schools (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  short_name           TEXT,
  tier_label           TEXT NOT NULL,
  tier_group           TEXT NOT NULL,
  tier_note            TEXT,
  area                 TEXT NOT NULL,
  regency              TEXT NOT NULL,
  catchment            TEXT NOT NULL,
  address              TEXT NOT NULL,
  curriculum           TEXT NOT NULL,
  languages            TEXT NOT NULL,
  grade_range          TEXT NOT NULL,
  age_min              INTEGER,
  age_max              INTEGER,
  enrollment_raw       TEXT NOT NULL,
  enrollment           INTEGER,
  enrollment_disclosed INTEGER NOT NULL,
  fee_low_idr          INTEGER,
  fee_high_idr         INTEGER,
  fee_low_usd          INTEGER,
  fee_high_usd         INTEGER,
  fee_note             TEXT NOT NULL,
  fee_published        INTEGER NOT NULL,
  straight_line_km     REAL NOT NULL,
  road_km              REAL NOT NULL,
  drive_minutes        INTEGER NOT NULL,
  notes                TEXT NOT NULL,
  lat                  REAL NOT NULL,
  lng                  REAL NOT NULL,
  geo_confidence       TEXT NOT NULL,
  geo_source           TEXT NOT NULL,
  why_it_competes      TEXT,
  key_watch_out        TEXT
);

CREATE TABLE school_curriculum_tags (
  school_id TEXT NOT NULL REFERENCES schools(id),
  tag       TEXT NOT NULL,
  PRIMARY KEY (school_id, tag)
);

CREATE TABLE school_languages (
  school_id TEXT NOT NULL REFERENCES schools(id),
  language  TEXT NOT NULL,
  PRIMARY KEY (school_id, language)
);

CREATE TABLE school_sources (
  school_id TEXT NOT NULL REFERENCES schools(id),
  source    TEXT NOT NULL,
  PRIMARY KEY (school_id, source)
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE INDEX idx_schools_tier      ON schools(tier_group);
CREATE INDEX idx_schools_catchment ON schools(catchment);
CREATE INDEX idx_schools_drive     ON schools(drive_minutes);

-- Mirrors the workbook's Fee Benchmark sheet.
CREATE VIEW tier1_fee_benchmark AS
  SELECT name,
         fee_low_idr  / 1000000.0 AS fee_low_idr_mm,
         fee_high_idr / 1000000.0 AS fee_high_idr_mm,
         fee_low_usd, fee_high_usd, drive_minutes, enrollment
    FROM schools
   WHERE tier_group IN ('tier1', 'subject') AND fee_published = 1
   ORDER BY fee_high_idr;
`;

function writeDatabase(schools: School[], meta: Meta) {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = DELETE"); // keep a single self-contained file
  db.exec(SCHEMA);

  const insertSchool = db.prepare(`
    INSERT INTO schools VALUES (
      @id, @name, @short_name, @tier_label, @tier_group, @tier_note,
      @area, @regency, @catchment, @address, @curriculum, @languages,
      @grade_range, @age_min, @age_max,
      @enrollment_raw, @enrollment, @enrollment_disclosed,
      @fee_low_idr, @fee_high_idr, @fee_low_usd, @fee_high_usd,
      @fee_note, @fee_published,
      @straight_line_km, @road_km, @drive_minutes,
      @notes, @lat, @lng, @geo_confidence, @geo_source,
      @why_it_competes, @key_watch_out
    )`);

  const insertTag = db.prepare(
    "INSERT OR IGNORE INTO school_curriculum_tags VALUES (?, ?)",
  );
  const insertLanguage = db.prepare(
    "INSERT OR IGNORE INTO school_languages VALUES (?, ?)",
  );
  const insertSource = db.prepare("INSERT OR IGNORE INTO school_sources VALUES (?, ?)");
  const insertMeta = db.prepare("INSERT INTO meta VALUES (?, ?)");

  db.transaction(() => {
    for (const s of schools) {
      insertSchool.run({
        id: s.id,
        name: s.name,
        short_name: s.shortName,
        tier_label: s.tierLabel,
        tier_group: s.tierGroup,
        tier_note: s.tierNote,
        area: s.area,
        regency: s.regency,
        catchment: s.catchment,
        address: s.address,
        curriculum: s.curriculum,
        languages: s.languages,
        grade_range: s.gradeRange,
        age_min: s.ageMin,
        age_max: s.ageMax,
        enrollment_raw: s.enrollmentRaw,
        enrollment: s.enrollment,
        enrollment_disclosed: s.enrollmentDisclosed ? 1 : 0,
        fee_low_idr: s.feeLowIdr,
        fee_high_idr: s.feeHighIdr,
        fee_low_usd: s.feeLowUsd,
        fee_high_usd: s.feeHighUsd,
        fee_note: s.feeNote,
        fee_published: s.feePublished ? 1 : 0,
        straight_line_km: s.straightLineKm,
        road_km: s.roadKm,
        drive_minutes: s.driveMinutes,
        notes: s.notes,
        lat: s.lat,
        lng: s.lng,
        geo_confidence: s.geoConfidence,
        geo_source: s.geoSource,
        why_it_competes: s.whyItCompetes,
        key_watch_out: s.keyWatchOut,
      });

      for (const tag of s.curriculumTags) insertTag.run(s.id, tag);
      for (const language of s.mediumOfInstruction) insertLanguage.run(s.id, language);
      for (const source of s.sources) insertSource.run(s.id, source);
    }

    for (const [key, value] of Object.entries(meta)) {
      insertMeta.run(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  })();

  db.close();
}

/* ------------------------------------------------------------ typescript -- */

async function writeTypescript(dataset: Dataset) {
  const banner = `// AUTO-GENERATED by scripts/etl.ts — do not edit by hand.
// Source: data/Bali_International_Schools_Competitive_Landscape.xlsx
// Regenerate with: npm run etl
`;

  const body = `${banner}
import type { Dataset } from "../lib/types";

export const dataset: Dataset = ${JSON.stringify(dataset, null, 2)};

export const schools = dataset.schools;
export const meta = dataset.meta;
`;

  await mkdir(path.dirname(OUT_TS), { recursive: true });
  await writeFile(OUT_TS, body);
}

/* ----------------------------------------------------------------- main -- */

async function main() {
  const { schools, meta } = await buildSchools();

  const moved = separateCollisions(schools);
  if (moved.length > 0) {
    console.log(`Separated ${moved.length} co-located marker(s): ${moved.join(", ")}\n`);
  }

  const problems = validate(schools);
  if (problems.length > 0) {
    console.error(`\n${problems.length} data problem(s):`);
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    console.error("");
    process.exitCode = 1;
  }

  writeDatabase(schools, meta);
  await writeTypescript({ meta, schools });

  const byTier = schools.reduce<Record<string, number>>((acc, s) => {
    acc[s.tierGroup] = (acc[s.tierGroup] ?? 0) + 1;
    return acc;
  }, {});
  const withFees = schools.filter((s) => s.feePublished).length;
  const withEnrollment = schools.filter((s) => s.enrollmentDisclosed).length;

  console.log(`Wrote ${schools.length} schools`);
  console.log(`  ${path.relative(ROOT, DB_PATH)}`);
  console.log(`  ${path.relative(ROOT, OUT_TS)}`);
  console.log(`\nBy tier: ${JSON.stringify(byTier)}`);
  console.log(`Published fees: ${withFees}/${schools.length}`);
  console.log(`Disclosed enrollment: ${withEnrollment}/${schools.length}`);
  if (problems.length === 0) console.log("\nAll validation checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
