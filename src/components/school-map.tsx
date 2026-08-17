import { useEffect, useMemo } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import { useChartColors } from "@/hooks/use-chart-colors";
import { useTheme } from "@/hooks/use-theme";
import { TIER_MARKER_RADIUS } from "@/lib/tiers";
import { formatDriveTime, formatFeeRange, formatKm } from "@/lib/format";
import { TIER_GROUP_LABEL, type Meta, type School } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * CARTO's OSM-derived basemaps. Positron and Dark Matter are the same
 * cartography in two lightnesses, so switching themes does not change what the
 * map says — only how bright it is.
 */
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Straight-line reference rings drawn around the Canggu origin, in km. */
const DISTANCE_RINGS_KM = [5, 10, 20, 40];

interface SchoolMapProps {
  schools: School[];
  meta: Meta;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

/**
 * Chooses the set of schools the viewport should frame.
 *
 * Three schools — Amed, and two in Singaraja — sit 60km+ away in catchments the
 * source workbook itself describes as outside any realistic Green School
 * catchment. Framing them stretches the viewport across the whole island and
 * squashes the 30-odd schools that actually compete into an unreadable blob. So
 * the automatic fit ignores distance outliers, unless doing so would hide a
 * meaningful share of what the filters selected — if someone filters *to* North
 * Bali, that is exactly where the map should go.
 */
function framingSet(schools: School[]): School[] {
  if (schools.length < 4) return schools;

  const sorted = [...schools].sort((a, b) => a.driveMinutes - b.driveMinutes);
  const p75 = sorted[Math.floor(sorted.length * 0.75)].driveMinutes;
  const cutoff = Math.max(p75 * 2, 45);

  const core = schools.filter((s) => s.driveMinutes <= cutoff);
  return core.length >= schools.length * 0.6 ? core : schools;
}

/** Keeps the viewport framed on whatever the filters currently show. */
function FitToSchools({ schools }: { schools: School[] }) {
  const map = useMap();

  useEffect(() => {
    const framed = framingSet(schools);
    if (framed.length === 0) return;

    const bounds = L.latLngBounds(framed.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 13, animate: true });
  }, [map, schools]);

  return null;
}

/** Zooms out to every school currently passing the filters, outliers included. */
function FitAllControl({ schools }: { schools: School[] }) {
  const map = useMap();

  const excluded = schools.length - framingSet(schools).length;
  if (excluded === 0) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const bounds = L.latLngBounds(
          schools.map((s) => [s.lat, s.lng] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [40, 40], animate: true });
      }}
      className="bg-card/90 text-foreground hover:bg-secondary absolute top-3 right-3 z-[900] rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur"
    >
      Show {excluded} distant school{excluded === 1 ? "" : "s"}
    </button>
  );
}

/** Pans to a school chosen from the table or the detail panel. */
function FlyToSelected({ school }: { school: School | null }) {
  const map = useMap();

  useEffect(() => {
    if (!school) return;
    map.flyTo([school.lat, school.lng], Math.max(map.getZoom(), 13), {
      duration: 0.6,
    });
  }, [map, school]);

  return null;
}

export function SchoolMap({
  schools,
  meta,
  selectedId,
  onSelect,
  className,
}: SchoolMapProps) {
  const { resolved } = useTheme();
  const colors = useChartColors();

  const selected = useMemo(
    () => schools.find((s) => s.id === selectedId) ?? null,
    [schools, selectedId],
  );

  // Draw the least prominent tiers first so Tier 1 and the subject school end
  // up on top wherever markers overlap.
  const ordered = useMemo(
    () =>
      [...schools].sort(
        (a, b) => TIER_MARKER_RADIUS[a.tierGroup] - TIER_MARKER_RADIUS[b.tierGroup],
      ),
    [schools],
  );

  const origin: [number, number] = [meta.canggu.lat, meta.canggu.lng];

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <MapContainer
        center={origin}
        zoom={11}
        scrollWheelZoom
        zoomControl
        className="h-full w-full"
        // Bali plus a margin; stops the user panning off into empty ocean.
        maxBounds={[
          [-9.4, 113.9],
          [-7.5, 116.3],
        ]}
        maxBoundsViscosity={0.7}
      >
        <TileLayer key={resolved} url={TILES[resolved]} attribution={ATTRIBUTION} />

        <FitToSchools schools={schools} />
        <FlyToSelected school={selected} />
        <FitAllControl schools={schools} />

        {/* Distance rings give the fee/drive-time numbers a spatial anchor. */}
        {DISTANCE_RINGS_KM.map((km) => (
          <Circle
            key={km}
            center={origin}
            radius={km * 1000}
            interactive={false}
            pathOptions={{
              color: colors.mutedForeground,
              weight: 1,
              opacity: 0.32,
              dashArray: "3 6",
              fill: false,
            }}
          />
        ))}

        {/* The origin every distance in the workbook is measured from. */}
        <CircleMarker
          center={origin}
          radius={5}
          pathOptions={{
            color: colors.mutedForeground,
            fillColor: colors.surface,
            weight: 2,
            opacity: 0.9,
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <span className="text-xs font-medium">
              Central Canggu — distance reference point
            </span>
          </Tooltip>
        </CircleMarker>

        {ordered.map((school) => {
          const isSelected = school.id === selectedId;
          const isSubject = school.tierGroup === "subject";
          const fill = colors.tier[school.tierGroup];

          return (
            <CircleMarker
              key={school.id}
              center={[school.lat, school.lng]}
              radius={TIER_MARKER_RADIUS[school.tierGroup] + (isSelected ? 4 : 0)}
              eventHandlers={{ click: () => onSelect(school.id) }}
              pathOptions={{
                color: isSelected ? colors.foreground : colors.surface,
                // A surface-coloured ring lifts every marker off the tiles, so
                // even the darkest ordinal step stays legible on dark mode.
                weight: isSelected ? 3 : isSubject ? 2.5 : 1.5,
                fillColor: fill,
                fillOpacity: 0.92,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <div className="max-w-56">
                  <div className="text-xs font-semibold">{school.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {TIER_GROUP_LABEL[school.tierGroup]} ·{" "}
                    {formatDriveTime(school.driveMinutes)} from Canggu
                  </div>
                </div>
              </Tooltip>

              <Popup autoPan closeButton>
                <div className="w-64 p-3">
                  <div className="text-sm leading-snug font-semibold">{school.name}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">{school.area}</div>

                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Tier</dt>
                      <dd className="text-right font-medium">
                        {TIER_GROUP_LABEL[school.tierGroup]}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Annual fee</dt>
                      <dd className="tnum text-right font-medium">
                        {formatFeeRange(school.feeLowIdr, school.feeHighIdr)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">From Canggu</dt>
                      <dd className="tnum text-right font-medium">
                        {formatDriveTime(school.driveMinutes)} · {formatKm(school.roadKm)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Ages</dt>
                      <dd className="text-right font-medium">
                        {school.ageMin !== null && school.ageMax !== null
                          ? `${school.ageMin}–${school.ageMax}`
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => onSelect(school.id)}
                    className="text-primary mt-3 text-xs font-medium underline underline-offset-4"
                  >
                    Open full profile
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {schools.length === 0 && (
        <div className="bg-background/85 pointer-events-none absolute inset-0 z-[1000] grid place-items-center backdrop-blur-[2px]">
          <p className="text-muted-foreground text-sm">
            No schools match the current filters.
          </p>
        </div>
      )}
    </div>
  );
}
