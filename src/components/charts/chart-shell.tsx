import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChartShellProps {
  title: string;
  description: string;
  /** Optional legend or note rendered beneath the plot. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartShell({
  title,
  description,
  footer,
  children,
  className,
}: ChartShellProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs leading-snug">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {footer}
      </CardContent>
    </Card>
  );
}

/** Shared tooltip surface so every chart's hover layer matches the theme. */
export function TooltipCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-popover text-popover-foreground border-border rounded-lg border px-3 py-2 shadow-lg">
      {children}
    </div>
  );
}

export function TooltipRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tnum font-medium">{value}</span>
    </div>
  );
}

/** Shown when filters exclude everything a chart needs. */
export function EmptyPlot({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground grid h-full min-h-40 place-items-center text-center text-xs">
      {message}
    </div>
  );
}
