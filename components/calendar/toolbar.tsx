"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clampStr, periodRange, periodTitle, shiftAnchor, type CalView } from "@/lib/calendar";

const VIEWS: { id: CalView; label: string }[] = [
  { id: "week", label: "Settimana" },
  { id: "month", label: "Mese" },
  { id: "year", label: "Anno" },
];

export function CalendarToolbar({
  view,
  anchor,
  today,
  minDate,
  maxDate,
  loading,
  onChange,
  right,
}: {
  view: CalView;
  anchor: string;
  today: string;
  minDate: string;
  maxDate: string;
  loading?: boolean;
  onChange: (view: CalView, anchor: string) => void;
  right?: React.ReactNode;
}) {
  const prev = shiftAnchor(view, anchor, -1);
  const next = shiftAnchor(view, anchor, 1);
  const prevDisabled = periodRange(view, prev).to < minDate;
  const nextDisabled = periodRange(view, next).from > maxDate;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => onChange(view, clampStr(today, minDate, maxDate))}>
        Oggi
      </Button>
      <div className="flex">
        <Button variant="ghost" size="icon" disabled={prevDisabled} onClick={() => onChange(view, prev)} aria-label="Precedente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" disabled={nextDisabled} onClick={() => onChange(view, next)} aria-label="Successivo">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <h2 className="min-w-[8rem] text-base font-semibold first-letter:uppercase">{periodTitle(view, anchor)}</h2>
      {loading && <span className="text-xs text-muted-foreground">Caricamento…</span>}
      <div className="ml-auto flex items-center gap-2">
        {right}
        <div className="flex rounded-md border border-border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onChange(v.id, anchor)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                view === v.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
