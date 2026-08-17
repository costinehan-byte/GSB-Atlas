import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TIER_SWATCH } from "@/lib/tiers";
import { sortByTier } from "@/lib/analytics";
import { formatCount, formatDriveTime, formatFeeRange } from "@/lib/format";
import { TIER_GROUP_LABEL, type School } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "name" | "tier" | "catchment" | "fee" | "drive" | "enrollment";
type Direction = "asc" | "desc";

interface Column {
  key: SortKey;
  label: string;
  numeric?: boolean;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: "name", label: "School" },
  { key: "tier", label: "Tier" },
  { key: "catchment", label: "Catchment", className: "hidden lg:table-cell" },
  { key: "fee", label: "Annual fee", numeric: true },
  { key: "drive", label: "From Canggu", numeric: true },
  { key: "enrollment", label: "Enrollment", numeric: true, className: "hidden md:table-cell" },
];

/**
 * Sort value for a column.
 *
 * Missing figures sort last in both directions rather than being treated as
 * zero — a school that does not publish fees is not the cheapest school.
 */
function compare(a: School, b: School, key: SortKey): number {
  const nullsLast = (x: number | null, y: number | null) => {
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  };

  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "tier":
      return sortByTier(a, b);
    case "catchment":
      return a.catchment.localeCompare(b.catchment) || a.name.localeCompare(b.name);
    case "fee":
      return nullsLast(a.feeHighIdr, b.feeHighIdr);
    case "drive":
      return a.driveMinutes - b.driveMinutes;
    case "enrollment":
      return nullsLast(a.enrollment, b.enrollment);
  }
}

export function SchoolTable({
  schools,
  selectedId,
  onSelect,
}: {
  schools: School[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [direction, setDirection] = useState<Direction>("asc");

  const sorted = useMemo(() => {
    const rows = [...schools].sort((a, b) => compare(a, b, sortKey));
    return direction === "asc" ? rows : rows.reverse();
  }, [schools, sortKey, direction]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("asc");
    }
  };

  if (schools.length === 0) {
    return (
      <p className="text-muted-foreground p-8 text-center text-sm">
        No schools match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              const Icon = !active
                ? ChevronsUpDown
                : direction === "asc"
                  ? ArrowUp
                  : ArrowDown;

              return (
                <TableHead
                  key={column.key}
                  className={cn(column.numeric && "text-right", column.className)}
                  aria-sort={
                    active
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={cn(
                      "hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors",
                      column.numeric && "flex-row-reverse",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {column.label}
                    <Icon aria-hidden className="size-3" />
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((school) => (
            <TableRow
              key={school.id}
              onClick={() => onSelect(school.id)}
              data-state={school.id === selectedId ? "selected" : undefined}
              className="cursor-pointer"
            >
              <TableCell className="max-w-64 font-medium">
                <span className="block truncate">{school.name}</span>
                <span className="text-muted-foreground block truncate text-xs font-normal">
                  {school.area}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1.5 font-normal whitespace-nowrap">
                  <span
                    aria-hidden
                    className={cn("size-2 rounded-full", TIER_SWATCH[school.tierGroup])}
                  />
                  {TIER_GROUP_LABEL[school.tierGroup]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground hidden lg:table-cell">
                {school.catchment}
              </TableCell>
              <TableCell className="tnum text-right whitespace-nowrap">
                {school.feePublished ? (
                  formatFeeRange(school.feeLowIdr, school.feeHighIdr)
                ) : (
                  <span className="text-muted-foreground">Not published</span>
                )}
              </TableCell>
              <TableCell className="tnum text-right whitespace-nowrap">
                {formatDriveTime(school.driveMinutes)}
              </TableCell>
              <TableCell className="tnum hidden text-right md:table-cell">
                {school.enrollmentDisclosed ? (
                  formatCount(school.enrollment)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
