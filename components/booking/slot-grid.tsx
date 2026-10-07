"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SlotStatus = "free" | "taken" | "mine";
type Slot = { start: string; end: string; label: string; status: SlotStatus; bookingId?: number };

export function SlotGrid({ date }: { date: string }) {
  const [slots, setSlots] = React.useState<Slot[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null); // start ISO in corso

  const load = React.useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/bookings?date=${date}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Impossibile caricare gli slot.");
      setSlots([]);
      return;
    }
    setSlots(data.slots);
  }, [date]);

  React.useEffect(() => {
    setSlots(null);
    load();
  }, [load]);

  async function book(slot: Slot) {
    setPending(slot.start);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: slot.start, end: slot.end }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Prenotazione non riuscita.");
        await load(); // ri-sincronizza lo stato (un altro utente potrebbe averlo appena preso)
        return;
      }
      await load();
    } finally {
      setPending(null);
    }
  }

  async function cancel(slot: Slot) {
    if (!slot.bookingId) return;
    setPending(slot.start);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${slot.bookingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Annullamento non riuscito.");
      }
      await load();
    } finally {
      setPending(null);
    }
  }

  if (slots === null) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Caricamento slot...</div>;
  }

  if (slots.length === 0 && !error) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Nessuno slot disponibile in questo giorno (weekend o festività).
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        <AnimatePresence initial={false}>
          {slots.map((slot) => (
            <motion.div
              key={slot.start}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
            >
              <button
                disabled={slot.status === "taken" || pending === slot.start}
                onClick={() => (slot.status === "mine" ? cancel(slot) : book(slot))}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-md border px-3 py-3 text-sm transition-colors",
                  slot.status === "free" && "border-border bg-card hover:border-accent hover:bg-accent/5",
                  slot.status === "mine" && "border-accent bg-accent/10 text-accent",
                  slot.status === "taken" && "cursor-not-allowed border-border bg-muted text-muted-foreground",
                  pending === slot.start && "opacity-60"
                )}
              >
                <span className="font-medium">{slot.label}</span>
                {slot.status === "mine" && (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" /> Tua prenotazione
                  </Badge>
                )}
                {slot.status === "taken" && (
                  <Badge variant="muted" className="gap-1">
                    <Lock className="h-3 w-3" /> Occupato
                  </Badge>
                )}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <p className="text-xs text-muted-foreground">
        Seleziona uno slot libero per prenotarlo. Clicca una tua prenotazione per annullarla.
        Ogni slot può essere assegnato a una sola persona alla volta: la verifica avviene a livello
        di database, quindi non è possibile che due persone occupino contemporaneamente lo stesso orario.
      </p>
    </div>
  );
}
