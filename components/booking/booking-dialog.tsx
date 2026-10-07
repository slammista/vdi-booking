"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { BOOKING_HORIZON_END, generateDaySlots } from "@/lib/slots";
import { todayRome } from "@/lib/calendar";

/** Prenotazione esistente in modifica, oppure null per una nuova. */
export type EditingBooking = { id: number; start: string; end: string } | null;

type Status = "free" | "taken" | "past";

/**
 * Editor unico per creare, spostare e annullare una prenotazione VDI.
 * Gli slot sono predefiniti (fasce orarie da 1 ora): niente durata libera.
 */
export function BookingDialog({
  booking,
  initialDate,
  initialStart,
  onClose,
  onDone,
}: {
  booking: EditingBooking;
  initialDate: string;
  /** Inizio (ms) dello slot preselezionato, ad esempio dalla cella cliccata. */
  initialStart?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = todayRome();
  const [date, setDate] = React.useState(initialDate);
  const [slotStart, setSlotStart] = React.useState<number | null>(
    booking ? new Date(booking.start).getTime() : (initialStart ?? null)
  );
  const [takenStarts, setTakenStarts] = React.useState<Set<number> | null>(null);
  const [reload, setReload] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const originalStart = booking ? new Date(booking.start).getTime() : null;
  const started = originalStart !== null && originalStart <= Date.now();
  const validDate = date >= today && date <= BOOKING_HORIZON_END;
  const slots = React.useMemo(() => (validDate ? generateDaySlots(date) : []), [date, validDate]);

  // Disponibilita' del giorno scelto (escludendo la prenotazione che sto modificando).
  React.useEffect(() => {
    if (!validDate) return setTakenStarts(new Set());
    let cancelled = false;
    setTakenStarts(null);
    fetch(`/api/bookings/range?from=${date}&to=${date}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Impossibile caricare la disponibilità.");
        if (cancelled) return;
        const taken = (data.bookings as { id: number; start: string }[])
          .filter((b) => b.id !== booking?.id)
          .map((b) => new Date(b.start).getTime());
        setTakenStarts(new Set(taken));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setTakenStarts(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [date, validDate, booking?.id, reload]);

  const statusOf = (startMs: number): Status =>
    startMs <= Date.now() ? "past" : takenStarts?.has(startMs) ? "taken" : "free";

  // Se la scelta non e' piu' valida (cambio giorno / slot occupato) passa al primo slot libero.
  React.useEffect(() => {
    if (takenStarts === null) return;
    if (slotStart !== null && slots.some((s) => s.start.getTime() === slotStart && statusOf(s.start.getTime()) === "free")) return;
    const first = slots.find((s) => statusOf(s.start.getTime()) === "free");
    setSlotStart(first ? first.start.getTime() : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takenStarts, slots]);

  const unchanged = booking !== null && slotStart === originalStart;
  const canSave = !busy && !started && takenStarts !== null && slotStart !== null && !unchanged;

  async function save() {
    const slot = slots.find((s) => s.start.getTime() === slotStart);
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(booking ? `/api/bookings/${booking.id}` : "/api/bookings", {
        method: booking ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: slot.start.toISOString(), end: slot.end.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Salvataggio non riuscito.");
        setReload((k) => k + 1); // un altro utente potrebbe aver preso lo slot
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Annullamento non riuscito.");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={booking ? "Modifica prenotazione VDI" : "Nuova prenotazione VDI"} onClose={() => !busy && onClose()}>
      <div className="flex flex-col gap-4">
        {started && (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Questa prenotazione è già iniziata: non si può più spostare, solo annullare.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-date">Giorno</Label>
            <Input
              id="b-date"
              type="date"
              value={date}
              min={today}
              max={BOOKING_HORIZON_END}
              disabled={started}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-slot">Slot (1 ora)</Label>
            <select
              id="b-slot"
              value={slotStart ?? ""}
              disabled={started || slots.length === 0}
              onChange={(e) => setSlotStart(Number(e.target.value))}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm disabled:opacity-50"
            >
              {slotStart === null && <option value="">—</option>}
              {slots.map((s) => {
                const ms = s.start.getTime();
                const st = takenStarts ? statusOf(ms) : "free";
                const suffix = st === "taken" ? " · Occupato" : st === "past" ? " · Passato" : ms === originalStart ? " · attuale" : "";
                return (
                  <option key={ms} value={ms} disabled={st !== "free"}>
                    {s.label}
                    {suffix}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {slots.length === 0 && (
          <p className="-mt-2 text-sm text-muted-foreground">
            Nessuno slot disponibile in questo giorno (weekend, festività o fuori dal periodo prenotabile).
          </p>
        )}
        {slots.length > 0 && takenStarts !== null && !slots.some((s) => statusOf(s.start.getTime()) === "free") && (
          <p className="-mt-2 text-sm text-muted-foreground">Giornata completa: scegli un altro giorno.</p>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div>
            {booking &&
              (confirmCancel ? (
                <Button variant="destructive" size="sm" disabled={busy} onClick={cancelBooking}>
                  Conferma annullamento
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Annulla prenotazione
                </Button>
              ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Chiudi
            </Button>
            <Button onClick={save} disabled={!canSave}>
              {booking ? "Salva modifiche" : "Prenota"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
