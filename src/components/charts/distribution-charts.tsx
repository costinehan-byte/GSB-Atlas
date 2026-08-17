import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartShell, EmptyPlot, TooltipCard, TooltipRow } from "./chart-shell";
import { TierLegend } from "@/components/tier-legend";
import { useChartColors } from "@/hooks/use-chart-colors";
import { countByTier, countCurriculumTags, type CountByTier } from "@/lib/analytics";
import { CATCHMENT_ORDER, TIER_GROUP_LABEL, TIER_ORDER, type School } from "@/lib/types";

function CatchmentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CountByTier }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <TooltipCard>
      <p className="mb-1.5 text-xs font-semibold">{row.label}</p>
      {TIER_ORDER.filter((tier) => row[tier] > 0).map((tier) => (
        <TooltipRow key={tier} label={TIER_GROUP_LABEL[tier]} value={row[tier]} />
      ))}
      <p className="tnum mt-1.5 flex justify-between gap-4 border-t pt-1.5 text-xs font-semibold">
        <span>Total</span>
        <span>{row.total}</span>
      </p>
    </TooltipCard>
  );
}

/**
 * Where the competition physically sits, split by tier.
 *
 * Colour here carries tier — real information layered on top of the category
 * already named by the axis — which is what earns a stacked bar rather than a
 * plain count.
 */
export function CatchmentChart({ schools }: { schools: School[] }) {
  const colors = useChartColors();

  const rows = useMemo(
    () => countByTier(schools, (s) => s.catchment, CATCHMENT_ORDER),
    [schools],
  );

  const presentTiers = useMemo(
    () => new Set(schools.map((s) => s.tierGroup)),
    [schools],
  );

  return (
    <ChartShell
      title="Schools by catchment"
      description="Grouped by the area families actually shop in, ordered outward from Canggu."
      footer={<TierLegend present={presentTiers} />}
    >
      {rows.length === 0 ? (
        <EmptyPlot message="No schools match the current filters." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 38)}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
            barCategoryGap="26%"
          >
            <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="2 4" />
            <XAxis
              type="number"
              allowDecimals={false}
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.border }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={118}
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<CatchmentTooltip />}
              cursor={{ fill: colors.mutedForeground, fillOpacity: 0.06 }}
            />
            {TIER_ORDER.map((tier, index) => (
              <Bar
                key={tier}
                dataKey={tier}
                stackId="tier"
                fill={colors.tier[tier]}
                maxBarSize={18}
                // A surface-coloured hairline separates adjacent segments.
                stroke={colors.surface}
                strokeWidth={1}
                radius={index === TIER_ORDER.length - 1 ? [0, 4, 4, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}

/**
 * Curriculum reach. One series, so one colour — the curriculum is already named
 * on the axis and a second colour channel would encode nothing.
 */
export function CurriculumChart({ schools }: { schools: School[] }) {
  const colors = useChartColors();
  const rows = useMemo(() => countCurriculumTags(schools), [schools]);

  return (
    <ChartShell
      title="Curriculum families represented"
      description="Schools offering each framework. A school teaching a dual pathway counts under both."
    >
      {rows.length === 0 ? (
        <EmptyPlot message="No schools match the current filters." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 30)}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
            barCategoryGap="24%"
          >
            <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="2 4" />
            <XAxis
              type="number"
              allowDecimals={false}
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.border }}
            />
            <YAxis
              type="category"
              dataKey="tag"
              width={150}
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: colors.mutedForeground, fillOpacity: 0.06 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as { tag: string; count: number };
                return (
                  <TooltipCard>
                    <p className="mb-1 text-xs font-semibold">{row.tag}</p>
                    <TooltipRow
                      label="Schools"
                      value={`${row.count} of ${schools.length}`}
                    />
                  </TooltipCard>
                );
              }}
            />
            <Bar
              dataKey="count"
              fill={colors.chart1}
              radius={[0, 4, 4, 0]}
              maxBarSize={16}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}
