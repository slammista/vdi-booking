"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { isBookableDay } from "@/lib/holidays";
import { DAY_END_HOUR, DAY_START_HOUR } from "@/lib/slots";
import {
  addDays,
  dayNumber,
  monthName,
  periodRange,
  startOfWeek,
  weekdayIdx,
  weekdayShort,
} from "@/lib/calendar";

const HOUR_H = 56; // px per ora nella vista settimanale
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export type CalEvent = {
  id: string;
  dateStr: string;
  startMin: number;
  endMin: number;
  title: string;
  subtitle?: string;
  tone: "mine" | "taken" | "lesson";
  onClick?: () => void;
};

const TONE: Record<CalEvent["tone"], string> = {
  // sfondo opaco (bg-card + tinta in inset-shadow) per coprire le righe delle celle disabilitate
  mine: "border-accent bg-card text-accent shadow-[inset_0_0_0_999px_hsl(var(--accent)/0.15)]",
  taken: "border-border bg-card text-muted-foreground shadow-[inset_0_0_0_999px_hsl(var(--muted))]",
  lesson: "border-success/50 bg-card text-foreground shadow-[inset_0_0_0_999px_hsl(var(--success)/0.15)]",
};

/** Dispone gli eventi sovrapposti in corsie affiancate. */
function layoutLanes(events: CalEvent[]): { ev: CalEvent; lane: number; lanes: number }[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: { ev: CalEvent; lane: number; lanes: number }[] = [];
  let cluster: typeof out = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const flush = () => {
    const lanes = laneEnds.length;
    cluster.forEach((c) => (c.lanes = lanes));
    out.push(...cluster);
    cluster = [];
    laneEnds.length = 0;
  };

  for (const ev of sorted) {
    if (ev.startMin >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = ev.endMin;
    cluster.push({ ev, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  if (cluster.length) flush();
  return out;
}

// ---------------------------------------------------------------------------
// Settimana (lun-ven, 09:00-18:00)
// ---------------------------------------------------------------------------
export function WeekView({
  anchor,
  today,
  minDate,
  maxDate,
  events,
  cellDisabled,
  onCellClick,
}: {
  anchor: string;
  today: string;
  minDate: string;
  maxDate: string;
  events: CalEvent[];
  cellDisabled: (dateStr: string, hour: number) => boolean;
  onCellClick: (dateStr: string, hour: number) => void;
}) {
  const monday = startOfWeek(anchor);
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

  // Su schermi stretti la griglia scorre in orizzontale: porta in vista il giorno corrente.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const box = scrollRef.current;
    const col = box?.querySelector<HTMLElement>(`[data-day="${today}"]`);
    if (box) box.scrollLeft = col ? Math.max(0, col.offsetLeft - 48) : 0;
  }, [anchor, today]);

  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="grid min-w-[560px] grid-cols-[48px_repeat(5,minmax(0,1fr))]">
        <div className="sticky left-0 z-10 border-b border-border bg-card" />
        {days.map((d) => {
          const off = !isBookableDay(d) || d < minDate || d > maxDate;
          const holiday = weekdayIdx(d) < 5 && !isBookableDay(d);
          return (
            <div
              key={d}
              data-day={d}
              className={cn(
                "border-b border-l border-border px-2 py-2 text-center",
                off && "text-muted-foreground"
              )}
            >
              <div className="text-xs uppercase tracking-wide">{weekdayShort(d)}</div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  d === today && "bg-accent text-accent-foreground"
                )}
              >
                {dayNumber(d)}
              </div>
              {holiday && <div className="text-[10px]">Festivo</div>}
            </div>
          );
        })}

        <div className="sticky left-0 z-10 bg-card">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_H }} className="pr-1.5 pt-0.5 text-right text-[11px] text-muted-foreground">
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((d) => {
          const dayOff = !isBookableDay(d) || d < minDate || d > maxDate;
          const lanes = layoutLanes(events.filter((e) => e.dateStr === d));
          return (
            <div key={d} className="relative border-l border-border" style={{ height: HOUR_H * hours.length }}>
              {hours.map((h) => {
                const disabled = dayOff || cellDisabled(d, h);
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={disabled}
                    onClick={() => onCellClick(d, h)}
                    style={{ height: HOUR_H }}
                    aria-label={`${d} ${h}:00`}
                    className={cn(
                      "block w-full border-b border-border/70 transition-colors",
                      disabled
                        ? "cursor-default bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,hsl(var(--muted)/0.7)_6px,hsl(var(--muted)/0.7)_12px)]"
                        : "hover:bg-accent/10"
                    )}
                  />
                );
              })}
              {lanes.map(({ ev, lane, lanes: n }) => {
                const top = ((ev.startMin - DAY_START_HOUR * 60) / 60) * HOUR_H;
                const height = ((ev.endMin - ev.startMin) / 60) * HOUR_H;
                const Tag = ev.onClick ? "button" : "div";
                return (
                  <Tag
                    key={ev.id}
                    onClick={ev.onClick}
                    title={`${ev.title}${ev.subtitle ? " · " + ev.subtitle : ""}`}
                    style={{
                      top: top + 1,
                      height: height - 2,
                      left: `calc(${(lane / n) * 100}% + 2px)`,
                      width: `calc(${100 / n}% - 4px)`,
                    }}
                    className={cn(
                      "absolute overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs leading-tight",
                      TONE[ev.tone],
                      ev.onClick && "cursor-pointer hover:brightness-95"
                    )}
                  >
                    <div className="truncate font-medium">{ev.title}</div>
                    {ev.subtitle && height > 40 && <div className="truncate opacity-80">{ev.subtitle}</div>}
                  </Tag>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mese
// ---------------------------------------------------------------------------
export function MonthView({
  anchor,
  today,
  minDate,
  maxDate,
  renderDay,
  onDayClick,
}: {
  anchor: string;
  today: string;
  minDate: string;
  maxDate: string;
  renderDay: (dateStr: string) => React.ReactNode;
  onDayClick: (dateStr: string) => void;
}) {
  const { from } = periodRange("month", anchor);
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const month = anchor.slice(0, 7);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="grid min-w-[560px] grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="border-b border-border px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const weekend = weekdayIdx(d) >= 5;
          const inMonth = d.startsWith(month);
          const off = !isBookableDay(d) || d < minDate || d > maxDate;
          return (
            <button
              key={d}
              type="button"
              disabled={off}
              onClick={() => onDayClick(d)}
              className={cn(
                "flex min-h-[84px] flex-col items-stretch gap-1 border-border p-1.5 text-left transition-colors",
                i >= 7 && "border-t",
                i % 7 !== 0 && "border-l",
                off ? "cursor-default bg-muted/30" : "hover:bg-accent/5",
                !inMonth && "opacity-45"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold",
                  d === today && "bg-accent text-accent-foreground",
                  weekend && d !== today && "text-muted-foreground"
                )}
              >
                {dayNumber(d)}
              </span>
              {!off && renderDay(d)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anno
// ---------------------------------------------------------------------------
export type YearTone = "none" | "partial" | "full" | "mine" | "lesson";

const YEAR_TONE: Record<YearTone, string> = {
  none: "",
  partial: "bg-accent/20",
  full: "bg-muted-foreground/30 text-foreground",
  mine: "bg-accent text-accent-foreground",
  lesson: "bg-success text-success-foreground",
};

export function YearView({
  anchor,
  today,
  minDate,
  maxDate,
  dayTone,
  onDayClick,
  onMonthClick,
}: {
  anchor: string;
  today: string;
  minDate: string;
  maxDate: string;
  dayTone: (dateStr: string) => YearTone;
  onDayClick: (dateStr: string) => void;
  onMonthClick: (monthStart: string) => void;
}) {
  const year = anchor.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, "0")}-01`);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {months.map((ms) => {
        const lead = weekdayIdx(ms);
        const daysInMonth = daysIn(ms);
        const cells: (string | null)[] = [
          ...Array(lead).fill(null),
          ...Array.from({ length: daysInMonth }, (_, i) => addDays(ms, i)),
        ];
        const monthOff = addDays(ms, daysInMonth - 1) < minDate || ms > maxDate;
        return (
          <div key={ms} className={cn("rounded-lg border border-border bg-card p-3", monthOff && "opacity-50")}>
            <button
              type="button"
              disabled={monthOff}
              onClick={() => onMonthClick(ms)}
              className="mb-2 text-sm font-semibold capitalize hover:text-accent disabled:hover:text-inherit"
            >
              {monthName(ms)}
            </button>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-muted-foreground">
                  {w[0]}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} />;
                const off = !isBookableDay(d) || d < minDate || d > maxDate;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={off}
                    onClick={() => onDayClick(d)}
                    title={d}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-sm transition-colors",
                      off ? "cursor-default text-muted-foreground/60" : cn("hover:ring-1 hover:ring-accent", YEAR_TONE[dayTone(d)]),
                      d === today && "ring-2 ring-foreground/70"
                    )}
                  >
                    {dayNumber(d)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function daysIn(monthStart: string): number {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
