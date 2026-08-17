import { useEffect, useState } from "react";

import { useTheme } from "./use-theme";
import { TIER_COLOR_VAR } from "@/lib/tiers";
import type { TierGroup } from "@/lib/types";

/**
 * Resolves the theme's CSS custom properties to concrete colour strings.
 *
 * Recharts renders SVG attributes (`fill`, `stroke`) that it also reads back for
 * legends and tooltips, and it does not resolve `var(--token)` itself. Rather
 * than duplicating the palette in JavaScript — which would let the two drift
 * apart — the values are read from the live computed style, so index.css stays
 * the single source of truth and a theme switch propagates automatically.
 */
export interface ChartColors {
  tier: Record<TierGroup, string>;
  chart1: string;
  chart2: string;
  foreground: string;
  mutedForeground: string;
  grid: string;
  border: string;
  surface: string;
}

const FALLBACK: ChartColors = {
  tier: {
    subject: "#008300",
    tier1: "#184f95",
    tier2: "#2a78d6",
    "tier2-3": "#5598e7",
    tier3: "#86b6ef",
  },
  chart1: "#2a78d6",
  chart2: "#eb6834",
  foreground: "#0b0b0b",
  mutedForeground: "#52514e",
  grid: "#e1e0d9",
  border: "#e1e0d9",
  surface: "#ffffff",
};

function readColors(): ChartColors {
  if (typeof window === "undefined") return FALLBACK;

  const styles = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: string) =>
    styles.getPropertyValue(token).trim() || fallback;

  return {
    tier: {
      subject: read(TIER_COLOR_VAR.subject, FALLBACK.tier.subject),
      tier1: read(TIER_COLOR_VAR.tier1, FALLBACK.tier.tier1),
      tier2: read(TIER_COLOR_VAR.tier2, FALLBACK.tier.tier2),
      "tier2-3": read(TIER_COLOR_VAR["tier2-3"], FALLBACK.tier["tier2-3"]),
      tier3: read(TIER_COLOR_VAR.tier3, FALLBACK.tier.tier3),
    },
    chart1: read("--chart-1", FALLBACK.chart1),
    chart2: read("--chart-2", FALLBACK.chart2),
    foreground: read("--foreground", FALLBACK.foreground),
    mutedForeground: read("--muted-foreground", FALLBACK.mutedForeground),
    grid: read("--grid", FALLBACK.grid),
    border: read("--border", FALLBACK.border),
    surface: read("--card", FALLBACK.surface),
  };
}

export function useChartColors(): ChartColors {
  const { resolved } = useTheme();
  const [colors, setColors] = useState<ChartColors>(readColors);

  useEffect(() => {
    // Re-read after the theme class lands on <html> and styles recalculate.
    const frame = requestAnimationFrame(() => setColors(readColors()));
    return () => cancelAnimationFrame(frame);
  }, [resolved]);

  return colors;
}
