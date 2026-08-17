import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartShell, EmptyPlot, TooltipCard, TooltipRow } from "./chart-shell";
import { useChartColors } from "@/hooks/use-chart-colors";
import { formatCount, shortLabel } from "@/lib/format";
import type { School } from "@/lib/types";

interface Row {
  id: string;
  label: string;
  name: string;
  enrollment: number;
  raw: string;
  isSubject: boolean;
}

/**
 * Disclosed enrollment, and the size of the hole around it.
 *
 * Only a handful of schools publish student numbers. Charting the five that do
 * without stating how many do not would imply the landscape is smaller than it
 * is, so the count of non-disclosing schools is part of the chart, not a
 * caveat buried elsewhere.
 */
export function EnrollmentChart({
  schools,
  totalInView,
}: {
  schools: School[];
  totalInView: number;
}) {
  const colors = useChartColors();

  const rows = useMemo<Row[]>(
    () =>
      schools
        .filter((s) => s.enrollmentDisclosed && s.enrollment !== null)
        .map((s) => ({
          id: s.id,
          label: shortLabel(s.name, s.shortName),
          name: s.name,
          enrollment: s.enrollment as number,
          raw: s.enrollmentRaw,
          isSubject: s.tierGroup === "subject",
        }))
        .sort((a, b) => b.enrollment - a.enrollment),
    [schools],
  );

  const undisclosed = totalInView - rows.length;

  return (
    <ChartShell
      title="Disclosed enrollment"
      description="Student numbers as published by the school. Ranges are shown at their midpoint."
      footer={
        <p className="text-muted-foreground text-[11px] leading-snug">
          {undisclosed > 0 ? (
            <>
              <span className="text-foreground font-medium">
                {undisclosed} of {totalInView}
              </span>{" "}
              schools in view do not publish enrollment — mostly Tier 2 and 3.
              Scale comparisons below Tier 1 are not possible from public data.
            </>
          ) : (
            "Every school in view publishes an enrollment figure."
          )}
        </p>
      }
    >
      {rows.length === 0 ? (
        <EmptyPlot message="No school in the current selection discloses enrollment." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 42)}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 44, bottom: 4, left: 8 }}
            barCategoryGap="30%"
          >
            <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="2 4" />
            <XAxis
              type="number"
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.border }}
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
              cursor={{ fill: colors.mutedForeground, fillOpacity: 0.06 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                return (
                  <TooltipCard>
                    <p className="mb-1.5 text-xs font-semibold">{row.name}</p>
                    <TooltipRow label="Students" value={formatCount(row.enrollment)} />
                    <p className="text-muted-foreground mt-1.5 max-w-56 border-t pt-1.5 text-[11px] leading-snug">
                      {row.raw}
                    </p>
                  </TooltipCard>
                );
              }}
            />
            <Bar dataKey="enrollment" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {rows.map((row) => (
                <Cell
                  key={row.id}
                  fill={row.isSubject ? colors.tier.subject : colors.chart1}
                />
              ))}
              {/* Few enough bars that every one can carry its value. */}
              <LabelList
                dataKey="enrollment"
                position="right"
                offset={8}
                fill={colors.mutedForeground}
                fontSize={11}
                formatter={(value) =>
                  typeof value === "number" ? formatCount(value) : ""
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}
