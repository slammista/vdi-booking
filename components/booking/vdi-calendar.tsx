"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CalendarToolbar } from "@/components/calendar/toolbar";
import { MonthView, WeekView, YearView, type CalEvent, type YearTone } from "@/components/calendar/views";
import { BOOKING_HORIZON_END, generateDaySlots, romeDateString } from "@/lib/slots";
import {
  clampStr,
  longDate,
  periodRange,
  romeMinutes,
  romeTime,
  todayRome,
  type CalView,
} from "@/lib/calendar";

type Booking = { id: number; start: string; end: string; mine: boolean };
type Pending =
  | { kind: "book"; start: Date; end: Date }
  | { kind: "cancel"; start: Date; end: Date; bookingId: number };

export function VdiCalendar() {
  const today = todayRome();
  const [view, setView] = React.useState<CalView>("week");
  const [anchor, setAnchor] = React.useState(today);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

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
    const cancellable = b.mine && start.getTime() > now;
    return {
      id: `b${b.id}`,
      dateStr: romeDateString(start),
      startMin: romeMinutes(start),
      endMin: romeMinutes(end) || 24 * 60,
      title: b.mine ? "Tua prenotazione" : "Occupato",
      subtitle: `${romeTime(start)} – ${romeTime(end)}`,
      tone: b.mine ? "mine" : "taken",
      onClick: cancellable ? () => openPending({ kind: "cancel", start, end, bookingId: b.id }) : undefined,
    };
  });

  function openPending(p: Pending) {
    setActionError(null);
    setPending(p);
  }

  function cellDisabled(d: string, hour: number) {
    const slot = generateDaySlots(d)[hour - 9];
    if (!slot) return true;
    return slot.start.getTime() <= now || takenByStart.has(slot.start.getTime());
  }

  function onCellClick(d: string, hour: number) {
    const slot = generateDaySlots(d)[hour - 9];
    if (slot) openPending({ kind: "book", start: slot.start, end: slot.end });
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      const res =
        pending.kind === "book"
          ? await fetch("/api/bookings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ start: pending.start.toISOString(), end: pending.end.toISOString() }),
            })
          : await fetch(`/api/bookings/${pending.bookingId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error ?? "Operazione non riuscita.");
        setReloadKey((k) => k + 1); // ri-sincronizza: un altro utente potrebbe aver preso lo slot
        return;
      }
      setPending(null);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
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

      {pending && (
        <Modal
          title={pending.kind === "book" ? "Conferma prenotazione" : "Annulla prenotazione"}
          onClose={() => !busy && setPending(null)}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              {pending.kind === "book" ? "Vuoi prenotare la VDI" : "Vuoi annullare la tua prenotazione"} per{" "}
              <strong className="first-letter:uppercase">{longDate(romeDateString(pending.start))}</strong> dalle{" "}
              <strong>{romeTime(pending.start)}</strong> alle <strong>{romeTime(pending.end)}</strong>?
            </p>
            {actionError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
                Indietro
              </Button>
              <Button
                onClick={confirm}
                disabled={busy}
                variant={pending.kind === "cancel" ? "destructive" : "default"}
              >
                {pending.kind === "book" ? "Prenota" : "Annulla prenotazione"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Legend({ view }: { view: CalView }) {
  const items =
    view === "year"
      ? [
          ["bg-accent", "Hai una prenotazione"],
          ["bg-accent/20", "Alcuni slot occupati"],
          ["bg-muted-foreground/30", "Giornata completa"],
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
