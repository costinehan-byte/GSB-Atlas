/**
 * Reads the source Excel workbook and normalises it into the domain model.
 *
 * The workbook is hand-authored, so most columns are prose rather than typed
 * values. Everything that needs to be filtered, sorted or charted is parsed out
 * here once, at build time, and the verbatim text is always kept alongside it so
 * the UI can show the original wording.
 */

import ExcelJS from "exceljs";
import type { Catchment, TierGroup } from "../../src/lib/types.js";

export const SHEET = {
  overview: "Overview",
  landscape: "Full Landscape",
  tier1: "Tier 1 - Direct Competitors",
  fees: "Fee Benchmark",
  distance: "Distance from Canggu",
} as const;

/** Column indices in the "Full Landscape" sheet (1-based, matching Excel). */
const COL = {
  name: 1,
  tier: 2,
  area: 3,
  address: 4,
  curriculum: 5,
  languages: 6,
  gradeRange: 7,
  enrollment: 8,
  feeLowIdr: 9,
  feeHighIdr: 10,
  feeNote: 11,
  feeLowUsd: 12,
  feeHighUsd: 13,
  straightLineKm: 14,
  roadKm: 15,
  driveMinutes: 16,
  notes: 17,
  sources: 18,
} as const;

/** Column indices in the "Tier 1 - Direct Competitors" sheet. */
const T1_COL = { name: 1, whyItCompetes: 9, keyWatchOut: 10 } as const;

export interface RawSchoolRow {
  name: string;
  tier: string;
  area: string;
  address: string;
  curriculum: string;
  languages: string;
  gradeRange: string;
  enrollment: string;
  feeLowIdr: number | null;
  feeHighIdr: number | null;
  feeNote: string;
  feeLowUsd: number | null;
  feeHighUsd: number | null;
  straightLineKm: number;
  roadKm: number;
  driveMinutes: number;
  notes: string;
  sources: string;
  whyItCompetes: string | null;
  keyWatchOut: string | null;
}

/* ------------------------------------------------------------------ cells -- */

/** Flattens any ExcelJS cell value to plain text. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

/** Returns a finite number, or null for blanks and prose like "Not published". */
export function cellNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value);
  if (!text) return null;
  const cleaned = text.replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------- normalise -- */

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Splits "Bali Island School (BIS)" into a display name and an abbreviation.
 * Only treats the parenthetical as an abbreviation when its first token is a
 * short all-caps word, so "ProEd Global School (Umalas + Nuanu campuses)" and
 * "Empathy School International (Nature School)" keep their full names.
 */
export function splitName(raw: string): { name: string; shortName: string | null } {
  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { name: raw.trim(), shortName: null };

  const [, base, inner] = match;
  const firstToken = inner.trim().split(/\s+/)[0];
  const isAbbreviation = /^[A-Z]{2,5}$/.test(firstToken);

  return isAbbreviation
    ? { name: base.trim(), shortName: inner.trim() }
    : { name: raw.trim(), shortName: null };
}

/**
 * Collapses the workbook's free-text tier labels into a sortable group plus the
 * qualifier that follows the tier number, e.g.
 * "Tier 1 – Direct (new entrant)" → { group: "tier1", note: "new entrant" }.
 */
export function parseTier(label: string): { group: TierGroup; note: string | null } {
  const group: TierGroup = /subject school/i.test(label)
    ? "subject"
    : /tier\s*2\s*\/\s*3/i.test(label)
      ? "tier2-3"
      : /tier\s*1/i.test(label)
        ? "tier1"
        : /tier\s*2/i.test(label)
          ? "tier2"
          : "tier3";

  const parenthetical = label.match(/\(([^)]+)\)/)?.[1]?.trim() ?? null;
  const dashQualifier = label
    .replace(/\([^)]*\)/g, "")
    .match(/(?:–|—|-)\s*(.+)$/)?.[1]
    ?.trim();

  // "Tier 1 – Direct" adds nothing beyond the group label; "Tier 3 – niche" does.
  const note =
    parenthetical ??
    (dashQualifier && !/^direct$/i.test(dashQualifier) ? dashQualifier : null);

  return { group, note };
}

const REGENCIES = [
  "Badung",
  "Denpasar",
  "Gianyar",
  "Tabanan",
  "Karangasem",
  "Buleleng",
];

/** First regency named in the area string; ProEd spans two, so first wins. */
export function parseRegency(area: string): string {
  let best: { name: string; at: number } | null = null;
  for (const regency of REGENCIES) {
    const at = area.indexOf(regency);
    if (at !== -1 && (best === null || at < best.at)) best = { name: regency, at };
  }
  return best?.name ?? "Bali";
}

/**
 * Maps an area to the catchment families actually shop in. Ordered by
 * specificity — Canggu-corridor villages are checked before their parent
 * districts so e.g. "Umalas, Kuta Utara" lands in the Canggu corridor.
 */
export function parseCatchment(area: string, driveMinutes: number): Catchment {
  const a = area.toLowerCase();

  if (/amed|abang|karangasem|buleleng|sukasada|singaraja/.test(a)) {
    return "North & East Bali";
  }
  if (/ubud|tegallalang|tampaksiring|peliatan|sayan|\bmas\b|gianyar/.test(a)) {
    return "Ubud";
  }
  if (/pecatu|uluwatu|jimbaran|kuta selatan|nusa dua/.test(a)) {
    return "Bukit / Uluwatu";
  }
  if (/sanur/.test(a)) return "Sanur";
  if (
    /canggu|berawa|tibubeneng|umalas|kerobokan|pererenan|munggu|dalung|kuta utara|mengwi|batu bolong|seminyak/.test(
      a,
    )
  ) {
    return "Canggu corridor";
  }
  if (/tabanan|kediri|kedungu|belalang|buwit|nuanu/.test(a)) return "Tabanan";
  if (/denpasar|renon|sidakarya|serangan|pemecutan|ubung|sumerta|kesiman|padangsambian/.test(a)) {
    return "Denpasar";
  }

  // Nothing matched by name — fall back to proximity.
  return driveMinutes <= 25 ? "Canggu corridor" : "Denpasar";
}

/**
 * Derives curriculum families from the prose description.
 *
 * "IB-aligned" is stripped first: Green School Bali's diploma is described as
 * IB-aligned but the school is not an IB World School, and tagging it as IB
 * would misrepresent the competitive picture.
 */
export function parseCurriculumTags(curriculum: string): string[] {
  const text = curriculum.replace(/IB-aligned/gi, "");
  const tags: string[] = [];

  const add = (tag: string, pattern: RegExp) => {
    if (pattern.test(text)) tags.push(tag);
  };

  add("IB", /\bIB\b|International Baccalaureate|\bPYP\b|\bMYP\b|\bIBCP\b/);
  add("Cambridge", /Cambridge|IGCSE|A-Level|AS\/A-Level|\bICE\b/);
  add("British", /British|English National Curriculum|National Curriculum of England|EYFS|Edexcel/i);
  add("Australian", /Australian|ACARA|NAPLAN/);
  add("American", /American/);
  add("French", /French national curriculum|AEFE/);
  add("Montessori", /Montessori/);
  add("Indonesian / bilingual", /Indonesian|Diknas|\bSPK\b|national-plus|bilingual/i);
  add("Faith-based", /Christian|Methodist|Islamic|Catholic/i);
  add("SEN focus", /\bSEN\b|inclusion|special needs/i);
  add(
    "Progressive / alternative",
    /project-based|project- &|play-based|progressive|inquiry|nature|eco|world-schooling|place-based|IEYC|IPC|portfolio-based|sustainability/i,
  );

  // A handful of rows describe the curriculum only as "International", with no
  // named framework behind it. That is a real position in this market, not a
  // gap in the data, so it gets its own tag rather than being left untagged.
  if (tags.length === 0) tags.push("International (unspecified)");

  return tags;
}

/** Media of instruction — the languages listed before any parenthetical aside. */
export function parseMediumOfInstruction(languages: string): string[] {
  const head = languages.split("(")[0];
  return head
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const NOT_DISCLOSED = /not\s+(publicly\s+)?(disclosed|published|confirmed)|not\s+independently\s+confirmed/i;

/**
 * Pulls a headline enrollment figure out of prose such as "~630–650 (43+
 * nationalities)". Returns the midpoint of a range. Anything explicitly marked
 * as undisclosed returns null *before* any digits are read — several such cells
 * still contain numbers (academic years, campus hectares) that must not be
 * mistaken for a student count.
 */
export function parseEnrollment(raw: string): {
  value: number | null;
  disclosed: boolean;
} {
  if (!raw || NOT_DISCLOSED.test(raw)) return { value: null, disclosed: false };

  const match = raw.match(/^\D*?~?(\d[\d,]*)\s*(?:[–—-]\s*~?(\d[\d,]*))?/);
  if (!match) return { value: null, disclosed: false };

  const low = Number(match[1].replace(/,/g, ""));
  const high = match[2] ? Number(match[2].replace(/,/g, "")) : null;
  const value = high ? Math.round((low + high) / 2) : low;

  return Number.isFinite(value)
    ? { value, disclosed: true }
    : { value: null, disclosed: false };
}

/** Extracts the age band from strings like "Pre-K – Grade 12 (Ages 3–18)". */
export function parseAgeRange(gradeRange: string): {
  min: number | null;
  max: number | null;
} {
  const match = gradeRange.match(/ages?\s*~?(\d+)\s*(?:[–—-]|to)\s*~?(\d+)/i);
  if (!match) return { min: null, max: null };
  return { min: Number(match[1]), max: Number(match[2]) };
}

export function parseSources(raw: string): string[] {
  return raw
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ---------------------------------------------------------------- reader -- */

function requireSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) {
    const available = wb.worksheets.map((w) => `"${w.name}"`).join(", ");
    throw new Error(`Worksheet "${name}" not found. Available sheets: ${available}`);
  }
  return ws;
}

export async function readWorkbook(path: string): Promise<{
  rows: RawSchoolRow[];
  overview: string[][];
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  // Tier 1 commentary is keyed by school name and merged onto the main rows.
  const tier1 = new Map<string, { why: string; watchOut: string }>();
  const t1Sheet = requireSheet(wb, SHEET.tier1);
  t1Sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(T1_COL.name).value);
    if (!name) return;
    tier1.set(name, {
      why: cellText(row.getCell(T1_COL.whyItCompetes).value),
      watchOut: cellText(row.getCell(T1_COL.keyWatchOut).value),
    });
  });

  const rows: RawSchoolRow[] = [];
  const landscape = requireSheet(wb, SHEET.landscape);
  landscape.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(COL.name).value);
    if (!name) return;

    const cell = (index: number) => cellText(row.getCell(index).value);
    const num = (index: number) => cellNumber(row.getCell(index).value);
    const commentary = tier1.get(name);

    rows.push({
      name,
      tier: cell(COL.tier),
      area: cell(COL.area),
      address: cell(COL.address),
      curriculum: cell(COL.curriculum),
      languages: cell(COL.languages),
      gradeRange: cell(COL.gradeRange),
      enrollment: cell(COL.enrollment),
      feeLowIdr: num(COL.feeLowIdr),
      feeHighIdr: num(COL.feeHighIdr),
      feeNote: cell(COL.feeNote),
      feeLowUsd: num(COL.feeLowUsd),
      feeHighUsd: num(COL.feeHighUsd),
      straightLineKm: num(COL.straightLineKm) ?? 0,
      roadKm: num(COL.roadKm) ?? 0,
      driveMinutes: num(COL.driveMinutes) ?? 0,
      notes: cell(COL.notes),
      sources: cell(COL.sources),
      whyItCompetes: commentary?.why || null,
      keyWatchOut: commentary?.watchOut || null,
    });
  });

  if (rows.length === 0) {
    throw new Error(`No school rows parsed from "${SHEET.landscape}".`);
  }

  const overview: string[][] = [];
  requireSheet(wb, SHEET.overview).eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (c) => values.push(cellText(c.value)));
    if (values.some(Boolean)) overview.push(values);
  });

  return { rows, overview };
}
