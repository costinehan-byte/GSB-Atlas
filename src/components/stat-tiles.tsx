import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { formatDriveTime, formatIdr } from "@/lib/format";
import type { Summary } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface TileProps {
  label: string;
  value: ReactNode;
  detail: string;
  className?: string;
}

function Tile({ label, value, detail, className }: TileProps) {
  return (
    <Card className={cn("gap-0 p-4", className)}>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      {/* Proportional figures: these are standalone numbers, not a column. */}
      <p className="mt-2 text-3xl leading-none font-semibold">{value}</p>
      <p className="text-muted-foreground mt-2 text-xs leading-snug">{detail}</p>
    </Card>
  );
}

export function StatTiles({
  summary,
  totalInDataset,
}: {
  summary: Summary;
  totalInDataset: number;
}) {
  const showingAll = summary.total === totalInDataset;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tile
        label="Schools"
        value={summary.total}
        detail={
          showingAll
            ? "The full identified landscape"
            : `of ${totalInDataset} matching current filters`
        }
      />
      <Tile
        label="Direct competitors"
        value={summary.directCompetitors}
        detail="Tier 1 — full pathway, competing for the same families"
      />
      <Tile
        label="Within 30 min"
        value={summary.withinThirtyMinutes}
        detail="Competitors inside a typical daytime school run of Canggu"
      />
      <Tile
        label="Median top fee"
        value={summary.medianTopFeeIdr === null ? "—" : formatIdr(summary.medianTopFeeIdr)}
        detail={`Senior-year fee across the ${summary.publishedFees} schools publishing one`}
      />
      <Tile
        label="Median drive"
        value={
          summary.medianDriveMinutes === null
            ? "—"
            : formatDriveTime(summary.medianDriveMinutes)
        }
        detail="From central Canggu, typical daytime traffic"
      />
    </div>
  );
}
