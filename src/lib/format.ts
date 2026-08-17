/** Display formatting. Every figure in the UI goes through one of these. */

/** Rp 177.8m — the unit Bali school fees are actually discussed in. */
export function formatIdr(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const millions = value / 1_000_000;
  const digits = millions >= 100 ? 0 : 1;
  return `Rp ${millions.toFixed(digits)}m`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** A fee band, or the reason there isn't one. */
export function formatFeeRange(
  low: number | null,
  high: number | null,
  fallback = "Not published",
): string {
  if (low === null || high === null) return fallback;
  if (low === high) return `${formatIdr(low)} (flat)`;
  return `${formatIdr(low)} – ${formatIdr(high)}`;
}

export function formatDriveTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatKm(km: number): string {
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

/** Axis ticks: compact enough not to wrap, e.g. "150m". */
export function formatIdrAxis(value: number): string {
  return `${Math.round(value / 1_000_000)}m`;
}

/** Trims a long school name for use inside a chart axis. */
export function shortLabel(name: string, shortName: string | null): string {
  if (shortName) return shortName;
  return name.length > 24 ? `${name.slice(0, 22)}…` : name;
}
