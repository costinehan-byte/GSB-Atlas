import { TIER_MARKER_RADIUS, TIER_SWATCH } from "@/lib/tiers";
import { TIER_GROUP_LABEL, TIER_ORDER, type TierGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Identity is never carried by colour alone here: the swatch also scales with
 * tier, mirroring the marker sizes on the map.
 */
export function TierLegend({
  present,
  className,
}: {
  present?: Set<TierGroup>;
  className?: string;
}) {
  const tiers = TIER_ORDER.filter((tier) => !present || present.has(tier));

  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {tiers.map((tier) => (
        <li key={tier} className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn("border-card rounded-full border", TIER_SWATCH[tier])}
            style={{
              width: TIER_MARKER_RADIUS[tier] + 3,
              height: TIER_MARKER_RADIUS[tier] + 3,
            }}
          />
          <span className="text-muted-foreground text-xs">
            {TIER_GROUP_LABEL[tier]}
          </span>
        </li>
      ))}
    </ul>
  );
}
