import { AlertTriangle, MapPin, Target, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TIER_SWATCH } from "@/lib/tiers";
import {
  formatCount,
  formatDriveTime,
  formatFeeRange,
  formatKm,
  formatUsd,
} from "@/lib/format";
import { TIER_GROUP_LABEL, type School } from "@/lib/types";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-sm leading-snug">{children}</dd>
    </div>
  );
}

/** Confidence wording for how the marker's position was established. */
const GEO_NOTE: Record<School["geoConfidence"], string> = {
  exact: "Mapped to the school's own address.",
  approximate: "Mapped to the school's street.",
  area: "Mapped to the school's locality — exact campus position not published.",
};

export function SchoolDetail({
  school,
  onClose,
}: {
  school: School | null;
  onClose: () => void;
}) {
  if (!school) {
    return (
      <div className="text-muted-foreground grid h-full place-items-center p-8 text-center">
        <div className="space-y-2">
          <MapPin aria-hidden className="mx-auto size-6 opacity-40" />
          <p className="text-sm">Select a school on the map</p>
          <p className="text-xs">
            Its full profile, fee band and positioning notes appear here.
          </p>
        </div>
      </div>
    );
  }

  const usdRange =
    school.feeLowUsd !== null && school.feeHighUsd !== null
      ? `≈ ${formatUsd(school.feeLowUsd)} – ${formatUsd(school.feeHighUsd)}`
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-base leading-snug font-semibold">{school.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", TIER_SWATCH[school.tierGroup])}
              />
              {TIER_GROUP_LABEL[school.tierGroup]}
            </Badge>
            {school.tierNote && (
              <Badge variant="outline" className="font-normal">
                {school.tierNote}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close school profile"
          className="shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          {school.whyItCompetes && (
            <div className="bg-accent/50 space-y-1.5 rounded-lg p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Target aria-hidden className="size-3.5" />
                Why it competes
              </p>
              <p className="text-sm leading-snug">{school.whyItCompetes}</p>
            </div>
          )}

          {school.keyWatchOut && (
            <div className="border-destructive/30 bg-destructive/5 space-y-1.5 rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <AlertTriangle aria-hidden className="size-3.5" />
                Key watch-out
              </p>
              <p className="text-sm leading-snug">{school.keyWatchOut}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-4">
            <Field label="Annual fee">
              <span className="tnum">
                {formatFeeRange(school.feeLowIdr, school.feeHighIdr)}
              </span>
              {usdRange && (
                <span className="text-muted-foreground tnum mt-0.5 block text-xs">
                  {usdRange}
                </span>
              )}
            </Field>
            <Field label="Enrollment">
              {school.enrollmentDisclosed ? (
                <span className="tnum">{formatCount(school.enrollment)}</span>
              ) : (
                <span className="text-muted-foreground">Not disclosed</span>
              )}
            </Field>
            <Field label="From Canggu">
              <span className="tnum">{formatDriveTime(school.driveMinutes)}</span>
              <span className="text-muted-foreground tnum mt-0.5 block text-xs">
                {formatKm(school.roadKm)} by road
              </span>
            </Field>
            <Field label="Ages">
              {school.ageMin !== null && school.ageMax !== null
                ? `${school.ageMin}–${school.ageMax}`
                : "—"}
            </Field>
          </dl>

          <Separator />

          <dl className="space-y-4">
            <Field label="Grade range">{school.gradeRange}</Field>
            <Field label="Curriculum">
              <p>{school.curriculum}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {school.curriculumTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Field>
            <Field label="Languages">{school.languages}</Field>
            <Field label="Location">
              <p>{school.area}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{school.address}</p>
            </Field>
            {school.feeNote && <Field label="Fee notes">{school.feeNote}</Field>}
            <Field label="Positioning">{school.notes}</Field>
          </dl>

          <Separator />

          <div className="text-muted-foreground space-y-2 text-xs leading-snug">
            <p>
              <span className="font-medium">Sources:</span>{" "}
              {school.sources.join("; ") || "—"}
            </p>
            <p>
              <span className="font-medium">Map position:</span>{" "}
              {GEO_NOTE[school.geoConfidence]}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
