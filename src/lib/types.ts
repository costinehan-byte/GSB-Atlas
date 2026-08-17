/**
 * Canonical domain model for the Bali international-schools competitive
 * landscape. This module is the single source of truth for both the build-time
 * ETL (scripts/) and the dashboard UI (src/).
 */

/** Normalised competitive tier, collapsed from the workbook's free-text labels. */
export type TierGroup = "subject" | "tier1" | "tier2" | "tier2-3" | "tier3";

/**
 * Strategic catchment, derived from the school's area. More useful than the
 * administrative regency because it maps to how families actually choose.
 */
export type Catchment =
  | "Canggu corridor"
  | "Denpasar"
  | "Sanur"
  | "Ubud"
  | "Bukit / Uluwatu"
  | "Tabanan"
  | "North & East Bali";

/** How a school's map coordinate was resolved. */
export type GeoConfidence = "exact" | "approximate" | "area";

export interface School {
  /** URL-safe stable identifier derived from the school name. */
  id: string;
  /** Display name, with any trailing abbreviation stripped. */
  name: string;
  /** Common abbreviation (BIS, CCS, …) where the workbook supplies one. */
  shortName: string | null;

  /** Verbatim tier label from the workbook, e.g. "Tier 1 – Direct (new entrant)". */
  tierLabel: string;
  tierGroup: TierGroup;
  /** Qualifier inside the tier label, e.g. "new entrant", "niche – Francophone". */
  tierNote: string | null;

  area: string;
  regency: string;
  catchment: Catchment;
  address: string;

  curriculum: string;
  /** Curriculum families derived from the prose, for filtering and grouping. */
  curriculumTags: string[];

  /** Verbatim language column. */
  languages: string;
  /** Media of instruction, e.g. ["English"], ["English", "Indonesian"]. */
  mediumOfInstruction: string[];

  gradeRange: string;
  ageMin: number | null;
  ageMax: number | null;

  enrollmentRaw: string;
  /** Midpoint where the workbook gives a range; null when not disclosed. */
  enrollment: number | null;
  enrollmentDisclosed: boolean;

  feeLowIdr: number | null;
  feeHighIdr: number | null;
  feeLowUsd: number | null;
  feeHighUsd: number | null;
  feeNote: string;
  feePublished: boolean;

  straightLineKm: number;
  roadKm: number;
  driveMinutes: number;

  notes: string;
  sources: string[];

  lat: number;
  lng: number;
  geoConfidence: GeoConfidence;
  /** Human-readable provenance for the coordinate. */
  geoSource: string;

  /** Tier 1 sheet commentary — present only for direct competitors. */
  whyItCompetes: string | null;
  keyWatchOut: string | null;
}

/** Workbook-level provenance surfaced in the dashboard's About panel. */
export interface Meta {
  title: string;
  preparedFor: string;
  compiled: string;
  purpose: string;
  tierDefinitions: { label: string; definition: string }[];
  methodology: string[];
  /** IDR per 1 USD, as used for the workbook's approximate USD columns. */
  idrPerUsd: number;
  canggu: { lat: number; lng: number };
  generatedAt: string;
}

export interface Dataset {
  meta: Meta;
  schools: School[];
}

export const TIER_GROUP_LABEL: Record<TierGroup, string> = {
  subject: "Green School Bali",
  tier1: "Tier 1 — Direct",
  tier2: "Tier 2",
  "tier2-3": "Tier 2/3",
  tier3: "Tier 3",
};

/** Display order for tiers, most competitively relevant first. */
export const TIER_ORDER: TierGroup[] = [
  "subject",
  "tier1",
  "tier2",
  "tier2-3",
  "tier3",
];

export const CATCHMENT_ORDER: Catchment[] = [
  "Canggu corridor",
  "Tabanan",
  "Denpasar",
  "Sanur",
  "Bukit / Uluwatu",
  "Ubud",
  "North & East Bali",
];
