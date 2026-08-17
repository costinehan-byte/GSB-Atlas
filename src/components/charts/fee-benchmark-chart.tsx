import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartShell, EmptyPlot, TooltipCard, TooltipRow } from "./chart-shell";
import { useChartColors } from "@/hooks/use-chart-colors";
import { formatIdr, formatIdrAxis, formatUsd, shortLabel } from "@/lib/format";
import type { School } from "@/lib/types";

interface Row {
  id: string;
  label: string;
  name: string;
  /** Bar offset — the transparent run from zero up to the entry-level fee. */
  base: number;
  /** Bar length — the span between entry-level and senior-year fees. */
  span: number;
  low: number;
  high: number;
  lowUsd: number | null;
  highUsd: number | null;
  isSubject: boolean;
}

function FeeTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <TooltipCard>
      <p className="mb-1.5 text-xs font-semibold">{row.name}</p>
      <TooltipRow label="Entry-level" value={formatIdr(row.low)} />
      <TooltipRow label="Senior year" value={formatIdr(row.high)} />
      <TooltipRow
        label="Spread"
        value={formatIdr(row.high - row.low)}
      />
      {row.highUsd !== null && (
        <p className="text-muted-foreground mt-1.5 border-t pt-1.5 text-[11px]">
          ≈ {formatUsd(row.lowUsd)} – {formatUsd(row.highUsd)}
        </p>
      )}
    </TooltipCard>
  );
}

/**
 * Floating bars spanning each school's entry-level to senior-year fee.
 *
 * A range is the point here — a single "average fee" bar would hide that Bali
 * Island School opens at a third of Green School's entry price but closes the
 * gap almost entirely by the diploma years. Implemented as a transparent base
 * bar plus a visible span bar, which is how Recharts expresses a floating bar.
 */
export function FeeBenchmarkChart({ schools }: { schools: School[] }) {
  const colors = useChartColors();

  const rows = useMemo<Row[]>(
    () =>
      schools
        .filter(
          (s) =>
            (s.tierGroup === "tier1" || s.tierGroup === "subject") && s.feePublished,
        )
        .map((s) => ({
          id: s.id,
          label: shortLabel(s.name, s.shortName),
          name: s.name,
          base: s.feeLowIdr as number,
          span: (s.feeHighIdr as number) - (s.feeLowIdr as number),
          low: s.feeLowIdr as number,
          high: s.feeHighIdr as number,
          lowUsd: s.feeLowUsd,
          highUsd: s.feeHighUsd,
          isSubject: s.tierGroup === "subject",
        }))
        .sort((a, b) => a.high - b.high),
    [schools],
  );

  return (
    <ChartShell
      title="Annual tuition range — direct competitors"
      description="Entry-level to senior-year fee. Bar length is the spread a family pays across a full school career, not a single price."
      footer={
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="bg-tier-subject h-2.5 w-4 rounded-[2px]"
            />
            <span className="text-muted-foreground">Green School Bali</span>
          </span>
          <span className="flex items-center gap-2 text-xs">
            <span aria-hidden className="bg-tier-1 h-2.5 w-4 rounded-[2px]" />
            <span className="text-muted-foreground">Tier 1 competitor</span>
          </span>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyPlot message="No Tier 1 schools with published fees match the current filters." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 42)}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              horizontal={false}
              stroke={colors.grid}
              strokeDasharray="2 4"
            />
            <XAxis
              type="number"
              tickFormatter={formatIdrAxis}
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.border }}
              label={{
                value: "IDR per year (millions)",
                position: "insideBottom",
                offset: -2,
                fill: colors.mutedForeground,
                fontSize: 11,
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={116}
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<FeeTooltip />}
              cursor={{ fill: colors.mutedForeground, fillOpacity: 0.06 }}
            />
            {/* Invisible run-up: positions the visible span at the entry fee. */}
            <Bar dataKey="base" stackId="fee" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="span" stackId="fee" radius={[4, 4, 4, 4]} maxBarSize={18}>
              {rows.map((row) => (
                <Cell
                  key={row.id}
                  fill={row.isSubject ? colors.tier.subject : colors.tier.tier1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}
