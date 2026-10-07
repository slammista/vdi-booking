import { isBookableDay } from "./holidays";

export const SLOT_DURATION_MINUTES = 60;
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 18;
export const TIMEZONE = "Europe/Rome";

export type Slot = {
  start: Date;
  end: Date;
  label: string; // es. "09:00 - 10:00"
};

/**
 * Genera tutti gli slot prenotabili di una giornata (09:00-18:00, passo di
 * SLOT_DURATION_MINUTES). Se il giorno non e' prenotabile (weekend o
 * festivita'), ritorna un array vuoto.
 *
 * Nota: le date vengono costruite usando l'ora locale del runtime. In
 * produzione su Vercel, imposta la variabile d'ambiente TZ=Europe/Rome
 * (vedi .env.example) cosi' che i calcoli coincidano con il fuso richiesto
 * anche se la funzione serverless gira fisicamente altrove.
 */
export function generateDaySlots(day: Date): Slot[] {
  if (!isBookableDay(day)) return [];

  const slots: Slot[] = [];
  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const count = Math.floor(totalMinutes / SLOT_DURATION_MINUTES);

  for (let i = 0; i < count; i++) {
    const start = new Date(day);
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + i * SLOT_DURATION_MINUTES);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + SLOT_DURATION_MINUTES);

    slots.push({
      start,
      end,
      label: `${fmtTime(start)} - ${fmtTime(end)}`,
    });
  }
  return slots;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/** Ritorna i prossimi N giorni lavorativi (bookable) a partire da oggi incluso. */
export function nextBookableDays(count: number, from: Date = new Date()): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
    if (isBookableDay(cursor)) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
