import { BOOKING_HORIZON_END, generateDaySlots, romeDateString } from "./slots";

export type SlotCheck = { ok: true; start: Date; end: Date } | { ok: false; error: string };

/**
 * Regole di business per uno slot VDI richiesto dal client (prenotazione o
 * spostamento): deve essere uno degli slot ufficiali, futuro e entro l'orizzonte.
 */
export function validateBookingSlot(start: string, end: string): SlotCheck {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false, error: "Richiesta non valida." };
  }
  if (startDate.getTime() <= Date.now()) {
    return { ok: false, error: "Non è possibile prenotare uno slot già iniziato o passato." };
  }
  const day = romeDateString(startDate);
  if (day > BOOKING_HORIZON_END) {
    return { ok: false, error: "Le prenotazioni sono aperte fino al 31/03/2030." };
  }
  const known = generateDaySlots(day).some(
    (s) => s.start.getTime() === startDate.getTime() && s.end.getTime() === endDate.getTime()
  );
  if (!known) {
    return {
      ok: false,
      error: "Lo slot richiesto non rientra negli orari prenotabili (09:00-18:00, lun-ven, festività escluse).",
    };
  }
  return { ok: true, start: startDate, end: endDate };
}
