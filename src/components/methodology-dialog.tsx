import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Meta, School } from "@/lib/types";

/**
 * Provenance, verbatim from the workbook, plus what this dashboard added on top
 * of it. The geocoding is the one thing on screen that is not in the source
 * file, so it is stated plainly rather than left for someone to discover.
 */
export function MethodologyDialog({
  meta,
  schools,
}: {
  meta: Meta;
  schools: School[];
}) {
  const exact = schools.filter((s) => s.geoConfidence === "exact").length;
  const approximate = schools.filter((s) => s.geoConfidence === "approximate").length;
  const area = schools.filter((s) => s.geoConfidence === "area").length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Info aria-hidden className="size-4" />
          Methodology
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sources &amp; methodology</DialogTitle>
          <DialogDescription>
            {meta.preparedFor} · compiled {meta.compiled}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 text-sm leading-relaxed">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase">Purpose</h3>
              <p className="text-muted-foreground">{meta.purpose}</p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase">
                Competitive tiers
              </h3>
              <dl className="space-y-3">
                {meta.tierDefinitions.map((tier) => (
                  <div key={tier.label} className="space-y-0.5">
                    <dt className="font-medium">{tier.label}</dt>
                    <dd className="text-muted-foreground text-xs leading-snug">
                      {tier.definition}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase">
                Source workbook
              </h3>
              <ul className="text-muted-foreground space-y-2 text-xs leading-snug">
                {meta.methodology.map((note, index) => (
                  <li key={index} className="flex gap-2">
                    <span aria-hidden className="text-foreground/40">
                      •
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase">
                Map positions
              </h3>
              <p className="text-muted-foreground text-xs leading-snug">
                The source workbook records addresses and each school's
                straight-line distance from Canggu, but no coordinates. Positions
                were geocoded from OpenStreetMap and then checked against that
                recorded distance, so a geocoder result for the wrong place is
                rejected rather than plotted. Of {schools.length} schools,{" "}
                <span className="text-foreground font-medium">{exact}</span> are
                mapped to their own address,{" "}
                <span className="text-foreground font-medium">{approximate}</span>{" "}
                to their street, and{" "}
                <span className="text-foreground font-medium">{area}</span> to their
                locality at the recorded distance from Canggu. Locality-level
                positions are indicative of the area, not the campus gate.
              </p>
              <p className="text-muted-foreground text-xs leading-snug">
                Distance rings on the map are straight-line from central Canggu (
                {meta.canggu.lat.toFixed(4)}, {meta.canggu.lng.toFixed(4)}). Drive
                times come from the workbook and describe typical daytime traffic.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide uppercase">
                Reading the figures
              </h3>
              <p className="text-muted-foreground text-xs leading-snug">
                USD figures are the workbook's own approximations at IDR{" "}
                {meta.idrPerUsd.toLocaleString("en-US")} = USD 1, for reference
                only — no school quotes in USD. Fees reset each academic year and
                several schools publish none at all; enrollment is undisclosed for
                most of the landscape. Verify directly with each school before
                using any of this in board-level material.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
