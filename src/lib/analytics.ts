/**
 * Filtering and derived statistics.
 *
 * All of it is pure and synchronous — the dataset is 38 rows, so the dashboard
 * recomputes from scratch on every interaction rather than maintaining caches
 * that could drift out of step with the filters.
 */

import type { Catchment, School, TierGroup } from "./types";
import { TIER_ORDER } from "./types";

export interface Filters {
  search: string;
  tiers: TierGroup[];
  catchments: Catchment[];
  curriculumTags: string[];
  /** Upper bound on drive time from Canggu, in minutes. */
  maxDriveMinutes: number;
  /** Upper bound on the school's top annual fee, in IDR. */
  maxFeeIdr: number;
  /** Exclude schools that do not publish fees. */
  publishedFeesOnly: boolean;
}

export function defaultFilters(bounds: Bounds): Filters {
  return {
    search: "",
    tiers: [],
    catchments: [],
    curriculumTags: [],
    maxDriveMinutes: bounds.maxDriveMinutes,
    maxFeeIdr: bounds.maxFeeIdr,
    publishedFeesOnly: false,
  };
}

export interface Bounds {
  maxDriveMinutes: number;
  maxFeeIdr: number;
}

export function computeBounds(schools: School[]): Bounds {
  return {
    maxDriveMinutes: Math.max(...schools.map((s) => s.driveMinutes)),
    maxFeeIdr: Math.max(...schools.map((s) => s.feeHighIdr ?? 0)),
  };
}

export function isFiltered(filters: Filters, bounds: Bounds): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.tiers.length > 0 ||
    filters.catchments.length > 0 ||
    filters.curriculumTags.length > 0 ||
    filters.maxDriveMinutes < bounds.maxDriveMinutes ||
    filters.maxFeeIdr < bounds.maxFeeIdr ||
    filters.publishedFeesOnly
  );
}

export function applyFilters(schools: School[], filters: Filters): School[] {
  const needle = filters.search.trim().toLowerCase();

  return schools.filter((school) => {
    if (filters.tiers.length > 0 && !filters.tiers.includes(school.tierGroup)) {
      return false;
    }
    if (
      filters.catchments.length > 0 &&
      !filters.catchments.includes(school.catchment)
    ) {
      return false;
    }
    if (
      filters.curriculumTags.length > 0 &&
      !filters.curriculumTags.some((tag) => school.curriculumTags.includes(tag))
    ) {
      return false;
    }
    if (school.driveMinutes > filters.maxDriveMinutes) return false;

    if (filters.publishedFeesOnly && !school.feePublished) return false;
    // Schools without published fees are kept under a fee ceiling rather than
    // dropped — their absence from the fee data is itself a finding, and the
    // dedicated toggle above is how you exclude them.
    if (school.feePublished && (school.feeHighIdr ?? 0) > filters.maxFeeIdr) {
      return false;
    }

    if (needle) {
      const haystack = [
        school.name,
        school.shortName ?? "",
        school.area,
        school.curriculum,
        school.notes,
        school.catchment,
        school.tierLabel,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

/* ----------------------------------------------------------------- stats -- */

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface Summary {
  total: number;
  directCompetitors: number;
  withinThirtyMinutes: number;
  publishedFees: number;
  medianTopFeeIdr: number | null;
  medianDriveMinutes: number | null;
  disclosedEnrollment: number;
  totalKnownEnrollment: number;
}

export function summarise(schools: School[]): Summary {
  const competitors = schools.filter((s) => s.tierGroup !== "subject");
  const topFees = schools
    .filter((s) => s.feeHighIdr !== null)
    .map((s) => s.feeHighIdr as number);

  return {
    total: schools.length,
    directCompetitors: schools.filter((s) => s.tierGroup === "tier1").length,
    withinThirtyMinutes: competitors.filter((s) => s.driveMinutes <= 30).length,
    publishedFees: schools.filter((s) => s.feePublished).length,
    medianTopFeeIdr: median(topFees),
    medianDriveMinutes: median(schools.map((s) => s.driveMinutes)),
    disclosedEnrollment: schools.filter((s) => s.enrollmentDisclosed).length,
    totalKnownEnrollment: schools.reduce((sum, s) => sum + (s.enrollment ?? 0), 0),
  };
}

/* ------------------------------------------------------------ groupings -- */

export interface CountByTier {
  key: string;
  label: string;
  total: number;
  subject: number;
  tier1: number;
  tier2: number;
  "tier2-3": number;
  tier3: number;
}

/** Counts schools per group, split by tier, for the stacked distribution bars. */
export function countByTier<K extends string>(
  schools: School[],
  keyOf: (school: School) => K,
  order: readonly K[],
): CountByTier[] {
  const buckets = new Map<string, CountByTier>();

  for (const key of order) {
    buckets.set(key, {
      key,
      label: key,
      total: 0,
      subject: 0,
      tier1: 0,
      tier2: 0,
      "tier2-3": 0,
      tier3: 0,
    });
  }

  for (const school of schools) {
    const key = keyOf(school);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: key,
        total: 0,
        subject: 0,
        tier1: 0,
        tier2: 0,
        "tier2-3": 0,
        tier3: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.total += 1;
    bucket[school.tierGroup] += 1;
  }

  return [...buckets.values()].filter((bucket) => bucket.total > 0);
}

export interface TagCount {
  tag: string;
  count: number;
}

export function countCurriculumTags(schools: School[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const school of schools) {
    for (const tag of school.curriculumTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function allCurriculumTags(schools: School[]): string[] {
  return countCurriculumTags(schools).map((t) => t.tag);
}

export function sortByTier(a: School, b: School): number {
  const delta = TIER_ORDER.indexOf(a.tierGroup) - TIER_ORDER.indexOf(b.tierGroup);
  return delta !== 0 ? delta : a.name.localeCompare(b.name);
}
