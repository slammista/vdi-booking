"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type DayOption = { iso: string; label: string; weekday: string };

export function WeekNavigator({
  days,
  selected,
  onSelect,
}: {
  days: DayOption[];
  selected: string;
  onSelect: (iso: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {days.map((d) => {
        const isActive = d.iso === selected;
        return (
          <button
            key={d.iso}
            onClick={() => onSelect(d.iso)}
            className={cn(
              "flex min-w-[72px] flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-accent bg-accent/10 text-accent font-semibold"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="text-xs uppercase tracking-wide">{d.weekday}</span>
            <span>{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}
