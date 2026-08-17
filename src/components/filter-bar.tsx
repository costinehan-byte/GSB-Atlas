import { RotateCcw, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatDriveTime, formatIdr } from "@/lib/format";
import { TIER_SWATCH } from "@/lib/tiers";
import type { Bounds, Filters } from "@/lib/analytics";
import {
  CATCHMENT_ORDER,
  TIER_GROUP_LABEL,
  TIER_ORDER,
  type Catchment,
  type TierGroup,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: Filters;
  bounds: Bounds;
  curriculumTags: string[];
  matched: number;
  total: number;
  dirty: boolean;
  onChange: (next: Filters) => void;
  onReset: () => void;
}

/** Adds or removes a value from a multi-select filter. */
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** A filter chip. Selection is carried by fill and weight, not colour alone. */
function Chip({
  active,
  onClick,
  children,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  swatch?: string;
}) {
  return (
    <Badge
      asChild
      variant={active ? "default" : "outline"}
      className={cn(
        "cursor-pointer gap-1.5 py-1 font-normal transition-colors select-none",
        active ? "font-medium" : "hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <button type="button" onClick={onClick} aria-pressed={active}>
        {swatch && (
          <span aria-hidden className={cn("size-2 rounded-full", swatch)} />
        )}
        {children}
      </button>
    </Badge>
  );
}

export function FilterBar({
  filters,
  bounds,
  curriculumTags,
  matched,
  total,
  dirty,
  onChange,
  onReset,
}: FilterBarProps) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            value={filters.search}
            onChange={(event) => set("search", event.target.value)}
            placeholder="Search name, area, curriculum or positioning…"
            aria-label="Search schools"
            className="pl-9"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set("search", "")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="published-fees"
            checked={filters.publishedFeesOnly}
            onCheckedChange={(checked) => set("publishedFeesOnly", checked)}
          />
          <Label htmlFor="published-fees" className="text-sm font-normal">
            Published fees only
          </Label>
        </div>

        <p
          aria-live="polite"
          className="text-muted-foreground tnum text-sm whitespace-nowrap"
        >
          {matched} of {total} schools
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!dirty}
          className="gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <FilterGroup label="Competitive tier">
          {TIER_ORDER.map((tier: TierGroup) => (
            <Chip
              key={tier}
              active={filters.tiers.includes(tier)}
              onClick={() => set("tiers", toggle(filters.tiers, tier))}
              swatch={TIER_SWATCH[tier]}
            >
              {TIER_GROUP_LABEL[tier]}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Catchment">
          {CATCHMENT_ORDER.map((catchment: Catchment) => (
            <Chip
              key={catchment}
              active={filters.catchments.includes(catchment)}
              onClick={() => set("catchments", toggle(filters.catchments, catchment))}
            >
              {catchment}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Curriculum">
          {curriculumTags.map((tag) => (
            <Chip
              key={tag}
              active={filters.curriculumTags.includes(tag)}
              onClick={() =>
                set("curriculumTags", toggle(filters.curriculumTags, tag))
              }
            >
              {tag}
            </Chip>
          ))}
        </FilterGroup>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label
                htmlFor="drive-time"
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                Max drive from Canggu
              </Label>
              <span className="tnum text-sm font-medium">
                {formatDriveTime(filters.maxDriveMinutes)}
              </span>
            </div>
            <Slider
              id="drive-time"
              min={5}
              max={bounds.maxDriveMinutes}
              step={5}
              value={[filters.maxDriveMinutes]}
              onValueChange={([value]) => set("maxDriveMinutes", value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label
                htmlFor="max-fee"
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                Max top fee
              </Label>
              <span className="tnum text-sm font-medium">
                {formatIdr(filters.maxFeeIdr)}
              </span>
            </div>
            <Slider
              id="max-fee"
              min={20_000_000}
              max={bounds.maxFeeIdr}
              step={5_000_000}
              value={[filters.maxFeeIdr]}
              onValueChange={([value]) => set("maxFeeIdr", value)}
            />
            <p className="text-muted-foreground text-[11px] leading-snug">
              Schools that do not publish fees are kept regardless — use the
              toggle above to exclude them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
