import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { ChartShell, EmptyPlot, TooltipCard, TooltipRow } from "./chart-shell";
import { TierLegend } from "@/components/tier-legend";
import { useChartColors } from "@/hooks/use-chart-colors";
import { TIER_DOT_SIZE } from "@/lib/tiers";
import { formatDriveTime, formatIdr, formatIdrAxis } from "@/lib/format";
import { TIER_GROUP_LABEL, type School, type TierGroup } from "@/lib/types";

interface Point {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  tier: TierGroup;
  area: string;
  isSubject: boolean;
}

function PositionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <TooltipCard>
      <p className="text-xs font-semibold">{point.name}</p>
      <p className="text-muted-foreground mb-1.5 text-[11px]">{point.area}</p>
      <TooltipRow label="Top fee" value={formatIdr(point.y)} />
      <TooltipRow label="From Canggu" value={formatDriveTime(point.x)} />
      <TooltipRow label="Tier" value={TIER_GROUP_LABEL[point.tier]} />
    </TooltipCard>
  );
}

/**
 * Fee against drive time — where each school actually sits competitively.
 *
 * The reference lines are Green School Bali's own fee and drive time, which
 * splits the plot into meaningful quadrants: schools below and to the left are
 * both cheaper and closer to the Canggu family base, which is the combination
 * that costs enrollments.
 */
export function PositioningScatter({
  schools,
  onSelect,
}: {
  schools: School[];
  onSelect: (id: string) => void;
}) {
  const colors = useChartColors();

  const points = useMemo<Point[]>(
    () =>
      schools
        .filter((s) => s.feeHighIdr !== null)
        .map((s) => ({
          id: s.id,
          name: s.name,
          x: s.driveMinutes,
          y: s.feeHighIdr as number,
          z: TIER_DOT_SIZE[s.tierGroup],
          tier: s.tierGroup,
          area: s.area,
          isSubject: s.tierGroup === "subject",
        })),
    [schools],
  );

  const subject = points.find((p) => p.isSubject) ?? null;
  const presentTiers = useMemo(
    () => new Set(points.map((p) => p.tier)),
    [points],
  );

  return (
    <ChartShell
      title="Fee against distance — competitive position"
      description="Each school's senior-year fee plotted against its drive time from Canggu. Only schools that publish fees can appear."
      footer={
        <div className="space-y-2">
          <TierLegend present={presentTiers} />
          {subject && (
            <p className="text-muted-foreground text-[11px] leading-snug">
              Dashed lines mark Green School Bali. Schools in the lower-left
              quadrant are both cheaper and closer to Canggu.
            </p>
          )}
        </div>
      }
    >
      {points.length === 0 ? (
        <EmptyPlot message="No schools with published fees match the current filters." />
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 8, right: 20, bottom: 20, left: 8 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="x"
              name="Drive time"
              unit=" min"
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.border }}
              label={{
                value: "Drive time from Canggu (minutes)",
                position: "insideBottom",
                offset: -12,
                fill: colors.mutedForeground,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              tickFormatter={formatIdrAxis}
              stroke={colors.mutedForeground}
              tick={{ fill: colors.mutedForeground, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.border }}
              label={{
                value: "Top annual fee (IDR millions)",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: { textAnchor: "middle" },
                fill: colors.mutedForeground,
                fontSize: 11,
              }}
            />
            <ZAxis type="number" dataKey="z" range={[60, 200]} />

            {subject && (
              <>
                <ReferenceLine
                  x={subject.x}
                  stroke={colors.tier.subject}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <ReferenceLine
                  y={subject.y}
                  stroke={colors.tier.subject}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              </>
            )}

            <Tooltip
              content={<PositionTooltip />}
              cursor={{ stroke: colors.mutedForeground, strokeDasharray: "3 3" }}
            />

            <Scatter
              data={points}
              onClick={(point: unknown) => {
                const clicked = point as { id?: string };
                if (clicked?.id) onSelect(clicked.id);
              }}
              className="cursor-pointer"
            >
              {points.map((point) => (
                <Cell
                  key={point.id}
                  fill={colors.tier[point.tier]}
                  // A surface ring keeps overlapping dots readable.
                  stroke={colors.surface}
                  strokeWidth={point.isSubject ? 2.5 : 1.5}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}
