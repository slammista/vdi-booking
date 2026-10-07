import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { isBookableDay } from "./holidays";

export const SLOT_DURATION_MINUTES = 60;
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18;
export const TIMEZONE = "Europe/Rome";
/** Ultimo giorno (incluso) in cui si puo' prenotare o programmare una lezione. */
export const BOOKING_HORIZON_END = "2030-03-31";

export type Slot = {
  start: Date;
  end: Date;
  label: string; // es. "09:00 - 10:00"
};

/** Data (YYYY-MM-DD) di un istante, espressa nel fuso Europe/Rome. */
export function romeDateString(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd");
}

/** true se la stringa e' una data di calendario valida nel formato YYYY-MM-DD. */
export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Istanti UTC di inizio/fine della giornata di calendario in Europe/Rome. */
export function dayBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE),
    end: fromZonedTime(`${addDays(dateStr, 1)}T00:00:00`, TIMEZONE),
  };
}

function atRomeTime(dateStr: string, minutesFromMidnight: number): Date {
  const hh = String(Math.floor(minutesFromMidnight / 60)).padStart(2, "0");
  const mm = String(minutesFromMidnight % 60).padStart(2, "0");
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, TIMEZONE);
}

/**
 * Genera tutti gli slot prenotabili di una giornata (09:00-18:00 ora di
 * Roma, passo di SLOT_DURATION_MINUTES). `dateStr` e' una data di calendario
 * YYYY-MM-DD interpretata in Europe/Rome, indipendentemente dal fuso del
 * server (su Vercel e' UTC). Se il giorno non e' prenotabile (weekend o
 * festivita'), ritorna un array vuoto.
 */
export function generateDaySlots(dateStr: string): Slot[] {
  if (!isValidDateString(dateStr) || !isBookableDay(dateStr)) return [];

  const slots: Slot[] = [];
  const count = Math.floor(((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_DURATION_MINUTES);

  for (let i = 0; i < count; i++) {
    const startMin = DAY_START_HOUR * 60 + i * SLOT_DURATION_MINUTES;
    const start = atRomeTime(dateStr, startMin);
    const end = atRomeTime(dateStr, startMin + SLOT_DURATION_MINUTES);
    slots.push({
      start,
      end,
      label: `${formatInTimeZone(start, TIMEZONE, "HH:mm")} - ${formatInTimeZone(end, TIMEZONE, "HH:mm")}`,
    });
  }
  return slots;
}
