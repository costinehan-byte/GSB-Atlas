import { useCallback, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { FilterBar } from "@/components/filter-bar";
import { MethodologyDialog } from "@/components/methodology-dialog";
import { SchoolDetail } from "@/components/school-detail";
import { SchoolMap } from "@/components/school-map";
import { SchoolTable } from "@/components/school-table";
import { StatTiles } from "@/components/stat-tiles";
import { ThemeToggle } from "@/components/theme-toggle";
import { TierLegend } from "@/components/tier-legend";
import { FeeBenchmarkChart } from "@/components/charts/fee-benchmark-chart";
import { PositioningScatter } from "@/components/charts/positioning-scatter";
import {
  CatchmentChart,
  CurriculumChart,
} from "@/components/charts/distribution-charts";
import { EnrollmentChart } from "@/components/charts/enrollment-chart";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { meta, schools as allSchools } from "@/data/dataset.generated";
import {
  allCurriculumTags,
  applyFilters,
  computeBounds,
  defaultFilters,
  isFiltered,
  summarise,
  type Filters,
} from "@/lib/analytics";

export default function App() {
  const bounds = useMemo(() => computeBounds(allSchools), []);
  const curriculumTags = useMemo(() => allCurriculumTags(allSchools), []);

  const [filters, setFilters] = useState<Filters>(() => defaultFilters(bounds));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = useMemo(
    () => applyFilters(allSchools, filters),
    [filters],
  );
  const summary = useMemo(() => summarise(visible), [visible]);
  const dirty = isFiltered(filters, bounds);

  const selected = useMemo(
    () => allSchools.find((s) => s.id === selectedId) ?? null,
    [selectedId],
  );

  const reset = useCallback(() => setFilters(defaultFilters(bounds)), [bounds]);

  // Selecting a school that the filters exclude would leave the detail panel
  // describing something invisible on the map, so clear it instead.
  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id === null || visible.some((s) => s.id === id) ? id : null);
    },
    [visible],
  );

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              Bali International Schools — Competitive Landscape
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              Green School Bali · {allSchools.length} schools · compiled {meta.compiled}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((open) => !open)}
              className="gap-1.5 lg:hidden"
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal aria-hidden className="size-4" />
              Filters
            </Button>
            <MethodologyDialog meta={meta} schools={allSchools} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] space-y-4 px-4 py-4 lg:px-6 lg:py-6">
        <Card className={filtersOpen ? "p-4" : "hidden p-4 lg:block"}>
          <FilterBar
            filters={filters}
            bounds={bounds}
            curriculumTags={curriculumTags}
            matched={visible.length}
            total={allSchools.length}
            dirty={dirty}
            onChange={setFilters}
            onReset={reset}
          />
        </Card>

        <StatTiles summary={summary} totalInDataset={allSchools.length} />

        {/* Map and profile sit side by side on desktop; the map keeps a fixed
            height so the page scroll never fights the map's own drag. */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="relative overflow-hidden p-0">
            <div className="h-[440px] sm:h-[540px] xl:h-[640px]">
              <SchoolMap
                schools={visible}
                meta={meta}
                selectedId={selectedId}
                onSelect={select}
              />
            </div>
            <div className="bg-background/85 pointer-events-none absolute bottom-0 left-0 z-[900] rounded-tr-lg border-t border-r px-3 py-2 backdrop-blur">
              <TierLegend />
            </div>
          </Card>

          <Card className="overflow-hidden p-0 xl:h-[640px]">
            <SchoolDetail school={selected} onClose={() => select(null)} />
          </Card>
        </div>

        <Tabs defaultValue="positioning" className="space-y-4">
          <TabsList>
            <TabsTrigger value="positioning">Positioning</TabsTrigger>
            <TabsTrigger value="market">Market shape</TabsTrigger>
            <TabsTrigger value="table">All schools</TabsTrigger>
          </TabsList>

          <TabsContent value="positioning" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <PositioningScatter schools={visible} onSelect={select} />
              <FeeBenchmarkChart schools={visible} />
            </div>
          </TabsContent>

          <TabsContent value="market" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <CatchmentChart schools={visible} />
              <CurriculumChart schools={visible} />
              <EnrollmentChart schools={visible} totalInView={visible.length} />
            </div>
          </TabsContent>

          <TabsContent value="table">
            <Card className="overflow-hidden p-0">
              <SchoolTable
                schools={visible}
                selectedId={selectedId}
                onSelect={select}
              />
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="text-muted-foreground border-t pt-4 pb-2 text-xs leading-snug">
          <p>
            Figures reflect publicly available information as of {meta.compiled}.
            Fees reset each academic year and several schools publish none;
            enrollment is undisclosed for most of the landscape. Verify directly
            with each school before board-level use — see Methodology.
          </p>
        </footer>
      </main>
    </div>
  );
}
