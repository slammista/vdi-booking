// Festivita' nazionali italiane, calcolate dinamicamente (stessa identica
// logica usata in Python per il report Excel). Nessun aggiornamento manuale
// richiesto negli anni successivi: la Pasqua e' calcolata con l'algoritmo
// di Meeus/Jones/Butcher.

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function italianHolidays(year: number): Record<string, string> {
  const easter = easterSunday(year);
  const easterMonday = new Date(easter);
  easterMonday.setUTCDate(easter.getUTCDate() + 1);

  return {
    [fmt(new Date(Date.UTC(year, 0, 1)))]: "Capodanno",
    [fmt(new Date(Date.UTC(year, 0, 6)))]: "Epifania",
    [fmt(easter)]: "Pasqua",
    [fmt(easterMonday)]: "Lunedì dell'Angelo (Pasquetta)",
    [fmt(new Date(Date.UTC(year, 3, 25)))]: "Festa della Liberazione",
    [fmt(new Date(Date.UTC(year, 4, 1)))]: "Festa dei Lavoratori",
    [fmt(new Date(Date.UTC(year, 5, 2)))]: "Festa della Repubblica",
    [fmt(new Date(Date.UTC(year, 7, 15)))]: "Ferragosto",
    [fmt(new Date(Date.UTC(year, 10, 1)))]: "Ognissanti",
    [fmt(new Date(Date.UTC(year, 11, 8)))]: "Immacolata Concezione",
    [fmt(new Date(Date.UTC(year, 11, 25)))]: "Natale",
    [fmt(new Date(Date.UTC(year, 11, 26)))]: "Santo Stefano",
  };
}

/** Cache in memoria per evitare di ricalcolare ad ogni chiamata nello stesso processo. */
const cache = new Map<number, Record<string, string>>();
export function getHolidaysForYear(year: number): Record<string, string> {
  if (!cache.has(year)) cache.set(year, italianHolidays(year));
  return cache.get(year)!;
}

/** true se il giorno (Date in orario locale Europe/Rome) e' lun-ven e non festivo. */
export function isBookableDay(d: Date): boolean {
  const day = d.getDay(); // 0 = domenica, 6 = sabato (nel fuso locale del runtime)
  if (day === 0 || day === 6) return false;
  const holidays = getHolidaysForYear(d.getFullYear());
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return !holidays[key];
}
