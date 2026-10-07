"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BookingDialog, type EditingBooking } from "@/components/booking/booking-dialog";
import { CalendarToolbar } from "@/components/calendar/toolbar";
import { MonthView, WeekView, YearView, type CalEvent, type YearTone } from "@/components/calendar/views";
import { isBookableDay } from "@/lib/holidays";
import { BOOKING_HORIZON_END, generateDaySlots, romeDateString } from "@/lib/slots";
import {
  addDays,
  clampStr,
  longDate,
  periodRange,
  romeMinutes,
  romeTime,
  todayRome,
  type CalView,
} from "@/lib/calendar";

type Booking = { id: number; start: string; end: string; mine: boolean };
type Mine = { id: number; start: string; end: string };
type Editor = { booking: EditingBooking; date: string; start?: number };

export function VdiCalendar() {
  const today = todayRome();
  const [view, setView] = React.useState<CalView>("week");
  const [anchor, setAnchor] = React.useState(today);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [mine, setMine] = React.useState<Mine[]>([]);

  const range = React.useMemo(() => periodRange(view, anchor), [view, anchor]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/bookings/range?from=${range.from}&to=${range.to}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Impossibile caricare le prenotazioni.");
        if (!cancelled) setBookings(data.bookings);
      })
      .catch((e) => !cancelled && setLoadError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadKey]);

  React.useEffect(() => {
    fetch("/api/bookings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMine(d.bookings))
      .catch(() => {});
  }, [reloadKey]);

  const now = Date.now();
  const takenByStart = React.useMemo(() => new Map(bookings.map((b) => [new Date(b.start).getTime(), b])), [bookings]);
  const byDay = React.useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings) {
      const k = romeDateString(new Date(b.start));
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [bookings]);

  /** Slot liberi (futuri, non occupati) e prenotazioni dell'utente in un giorno. */
  function daySummary(d: string) {
    const slots = generateDaySlots(d);
    const free = slots.filter((s) => s.start.getTime() > now && !takenByStart.has(s.start.getTime())).length;
    const mine = (byDay.get(d) ?? []).filter((b) => b.mine).length;
    const taken = (byDay.get(d) ?? []).length;
    return { total: slots.length, free, mine, taken };
  }

  const events: CalEvent[] = bookings.map((b) => {
    const start = new Date(b.start);
    const end = new Date(b.end);
    const editable = b.mine && end.getTime() > now;
    return {
      id: `b${b.id}`,
      dateStr: romeDateString(start),
      startMin: romeMinutes(start),
      endMin: romeMinutes(end) || 24 * 60,
      title: b.mine ? "Tua prenotazione" : "Occupato",
      subtitle: `${romeTime(start)} – ${romeTime(end)}`,
      tone: b.mine ? "mine" : "taken",
      onClick: editable
        ? () => setEditor({ booking: { id: b.id, start: b.start, end: b.end }, date: romeDateString(start) })
        : undefined,
    };
  });

  function cellDisabled(d: string, hour: number) {
    const slot = generateDaySlots(d)[hour - 9];
    if (!slot) return true;
    return slot.start.getTime() <= now || takenByStart.has(slot.start.getTime());
  }

  function onCellClick(d: string, hour: number) {
    const slot = generateDaySlots(d)[hour - 9];
    if (slot) setEditor({ booking: null, date: d, start: slot.start.getTime() });
  }

  function newBooking() {
    let d = clampStr(anchor, today, BOOKING_HORIZON_END);
    for (let i = 0; i < 10 && !isBookableDay(d); i++) d = addDays(d, 1);
    setEditor({ booking: null, date: d });
  }

  const goWeek = (d: string) => {
    setView("week");
    setAnchor(d);
  };

  return (
    <div className="flex flex-col gap-3">
      <CalendarToolbar
        view={view}
        anchor={anchor}
        today={today}
        minDate={today}
        maxDate={BOOKING_HORIZON_END}
        loading={loading}
        onChange={(v, a) => {
          setView(v);
          setAnchor(clampStr(a, today, BOOKING_HORIZON_END));
        }}
        right={
          <Button size="sm" onClick={newBooking}>
            <Plus className="h-4 w-4" /> Nuova prenotazione
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {view === "week" && (
        <WeekView
          anchor={anchor}
          today={today}
          minDate={today}
          maxDate={BOOKING_HORIZON_END}
          events={events}
          cellDisabled={cellDisabled}
          onCellClick={onCellClick}
        />
      )}

      {view === "month" && (
        <MonthView
          anchor={anchor}
          today={today}
          minDate={today}
          maxDate={BOOKING_HORIZON_END}
          onDayClick={goWeek}
          renderDay={(d) => {
            const s = daySummary(d);
            if (s.total === 0) return null;
            return (
              <div className="flex flex-col gap-0.5 text-[11px] leading-tight">
                {s.mine > 0 && (
                  <span className="rounded bg-accent/15 px-1 py-0.5 font-medium text-accent">
                    {s.mine === 1 ? "1 tua prenotazione" : `${s.mine} tue prenotazioni`}
                  </span>
                )}
                {s.free > 0 ? (
                  <span className="text-muted-foreground">{s.free} liberi</span>
                ) : (
                  s.taken > 0 && <span className="text-muted-foreground">Completo</span>
                )}
              </div>
            );
          }}
        />
      )}

      {view === "year" && (
        <YearView
          anchor={anchor}
          today={today}
          minDate={today}
          maxDate={BOOKING_HORIZON_END}
          onDayClick={goWeek}
          onMonthClick={(m) => {
            setView("month");
            setAnchor(clampStr(m, today, BOOKING_HORIZON_END));
          }}
          dayTone={(d): YearTone => {
            const s = daySummary(d);
            if (s.total === 0) return "none";
            if (s.mine > 0) return "mine";
            if (s.free === 0 && s.taken > 0) return "full";
            if (s.taken > 0) return "partial";
            return "none";
          }}
        />
      )}

      <Legend view={view} />

      {editor && (
        <BookingDialog
          booking={editor.booking}
          initialDate={editor.date}
          initialStart={editor.start}
          onClose={() => setEditor(null)}
          onDone={() => {
            setEditor(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      <MyBookings
        items={mine}
        onEdit={(b) => setEditor({ booking: b, date: romeDateString(new Date(b.start)) })}
      />
    </div>
  );
}

function Legend({ view }: { view: CalView }) {
  const items =
    view === "year"
      ? [
          ["bg-accent", "Hai una prenotazione"],
          ["bg-muted-foreground/20", "Alcuni slot occupati"],
          ["bg-foreground/60", "Giornata completa"],
        ]
      : [
          ["bg-accent/15 border border-accent", "Tua prenotazione"],
          ["bg-muted border border-border", "Occupato"],
          ["bg-card border border-border", "Libero (clicca per prenotare)"],
        ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(([cls, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${cls}`} /> {label}
        </span>
      ))}
      <span>Prenotabile fino al 31/03/2030 · lun-ven 09:00-18:00 · ogni slot è esclusivo</span>
    </div>
  );
}

function MyBookings({ items, onEdit }: { items: Mine[]; onEdit: (b: Mine) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-2 rounded-lg border border-border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold">Le tue prenotazioni ({items.length})</h3>
      <ul className="flex flex-col divide-y divide-border">
        {items.map((b) => {
          const start = new Date(b.start);
          return (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="first-letter:uppercase">{longDate(romeDateString(start))}</span> · {romeTime(start)}–
                {romeTime(new Date(b.end))}
              </span>
              <Button size="sm" variant="outline" onClick={() => onEdit(b)}>
                Modifica o annulla
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
