/**
 * Visual encoding for competitive tier.
 *
 * Tier is ordinal, so colour runs along a single hue and marker size runs with
 * it. The size channel is deliberately redundant with colour: adjacent steps on
 * an ordinal ramp differ mostly in lightness, which map tiles can wash out, so
 * size carries the same information independently.
 */

import type { TierGroup } from "./types";

/** CSS custom property holding this tier's colour, defined in index.css. */
export const TIER_COLOR_VAR: Record<TierGroup, string> = {
  subject: "--tier-subject",
  tier1: "--tier-1",
  tier2: "--tier-2",
  "tier2-3": "--tier-2-3",
  tier3: "--tier-3",
};

export const tierColor = (tier: TierGroup) => `var(${TIER_COLOR_VAR[tier]})`;

/** Marker radius in pixels. */
export const TIER_MARKER_RADIUS: Record<TierGroup, number> = {
  subject: 11,
  tier1: 9,
  tier2: 7,
  "tier2-3": 6,
  tier3: 5,
};

/** Scatter-plot marker area, kept proportional to the map's radii. */
export const TIER_DOT_SIZE: Record<TierGroup, number> = {
  subject: 200,
  tier1: 140,
  tier2: 95,
  "tier2-3": 75,
  tier3: 60,
};

/** Tailwind utility for a tier swatch, used in legends, chips and the table. */
export const TIER_SWATCH: Record<TierGroup, string> = {
  subject: "bg-tier-subject",
  tier1: "bg-tier-1",
  tier2: "bg-tier-2",
  "tier2-3": "bg-tier-2-3",
  tier3: "bg-tier-3",
};

/** Short description shown in the legend and tier filter. */
export const TIER_BLURB: Record<TierGroup, string> = {
  subject: "The school this landscape is drawn for",
  tier1: "Full pathway, credible curriculum, competes head-on",
  tier2: "Partial range or niche positioning",
  "tier2-3": "Small or primary-only, partial overlap",
  tier3: "Early-years, alternative, or a different catchment",
};
