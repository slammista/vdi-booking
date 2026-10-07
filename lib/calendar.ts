// Utility di calendario su stringhe "YYYY-MM-DD" (date di calendario senza
// fuso). L'aritmetica passa da UTC solo per evitare problemi di DST.
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE, addDays, romeDateString } from "./slots";

export { addDays };

export type CalView = "week" | "month" | "year";

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export const todayRome = () => romeDateString(new Date());

/** 0 = lunedi' ... 6 = domenica */
export function weekdayIdx(s: string): number {
  return (parse(s).getUTCDay() + 6) % 7;
}

export const startOfWeek = (s: string) => addDays(s, -weekdayIdx(s));
export const startOfMonth = (s: string) => `${s.slice(0, 7)}-01`;
export const endOfMonth = (s: string) => {
  const d = parse(startOfMonth(s));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return fmt(d);
};
export const startOfYear = (s: string) => `${s.slice(0, 4)}-01-01`;
export const endOfYear = (s: string) => `${s.slice(0, 4)}-12-31`;

export function addMonths(s: string, n: number): string {
  const d = parse(startOfMonth(s));
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return fmt(d);
}
export const addYears = (s: string, n: number) => addMonths(s, 12 * n);

/** Intervallo (inclusivo) di date mostrato da una vista. */
export function periodRange(view: CalView, anchor: string): { from: string; to: string } {
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  if (view === "month") {
    const from = startOfWeek(startOfMonth(anchor));
    return { from, to: addDays(from, 41) }; // griglia fissa 6 settimane
  }
  return { from: startOfYear(anchor), to: endOfYear(anchor) };
}

export function shiftAnchor(view: CalView, anchor: string, dir: 1 | -1): string {
  if (view === "week") return addDays(anchor, 7 * dir);
  if (view === "month") return addMonths(anchor, dir);
  return addYears(anchor, dir);
}

const it = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", ...opts });
const fmtDay = it({ day: "numeric" });
const fmtMonthYear = it({ month: "long", year: "numeric" });
const fmtMonth = it({ month: "long" });
const fmtWeekdayShort = it({ weekday: "short" });
const fmtLong = it({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShort = it({ weekday: "short", day: "numeric", month: "short" });

export const dayNumber = (s: string) => fmtDay.format(parse(s));
export const weekdayShort = (s: string) => fmtWeekdayShort.format(parse(s));
export const monthName = (s: string) => fmtMonth.format(parse(s));
export const longDate = (s: string) => fmtLong.format(parse(s));
export const shortDate = (s: string) => fmtShort.format(parse(s));

export function periodTitle(view: CalView, anchor: string): string {
  if (view === "year") return anchor.slice(0, 4);
  if (view === "month") return fmtMonthYear.format(parse(anchor));
  const { from } = periodRange("week", anchor);
  const to = addDays(from, 4);
  const a = parse(from);
  const b = parse(to);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const left = it(sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }).format(a);
  const right = it({ day: "numeric", month: "short", year: "numeric" }).format(b);
  return `${left} – ${right}`;
}

/** Minuti dalla mezzanotte, in ora di Roma, di un istante. */
export function romeMinutes(d: Date): number {
  const [h, m] = formatInTimeZone(d, TIMEZONE, "HH:mm").split(":").map(Number);
  return h * 60 + m;
}
export const romeTime = (d: Date) => formatInTimeZone(d, TIMEZONE, "HH:mm");
export const fmtMinutes = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const clampStr = (s: string, min: string, max: string) => (s < min ? min : s > max ? max : s);
