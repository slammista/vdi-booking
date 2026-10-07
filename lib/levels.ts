// Percorso formativo a livelli. Un livello e' "svolto" se coperto dal livello
// gia' affrontato importato dall'Excel (1..affrontato) oppure da una lezione
// conclusa a cui la persona ha partecipato (non segnata assente).

/** Numero massimo di livelli del percorso (modificare qui se cambia). */
export const MAX_LEVEL = 5;

export type LessonRef = {
  lessonId: number;
  level: number;
  start: Date | string;
  end: Date | string;
  attended: boolean;
};

export type StepStatus = "done" | "scheduled" | "next" | "todo";
export type Step = { level: number; status: StepStatus; date?: string };

export type Progress = {
  atteso: number | null;
  affrontato: number;
  /** livelli svolti (baseline inclusa) */
  done: number[];
  /** livelli con una lezione futura gia' assegnata */
  scheduled: { level: number; lessonId: number }[];
  /** primo livello (<= atteso) non ancora svolto: il prossimo step */
  next: number | null;
  /** come `next`, ma saltando i livelli gia' programmati: cosa assegnare adesso */
  recommended: number | null;
  steps: Step[];
};

const range = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);

/** Livello da assegnare: primo non svolto e non gia' programmato, entro il target. */
export function pickRecommended(target: number, done: number[], scheduledLevels: number[]): number | null {
  return range(target).find((l) => !done.includes(l) && !scheduledLevels.includes(l)) ?? null;
}

export function computeProgress(
  p: { atteso: number | null; affrontato: number },
  lessons: LessonRef[],
  now: number = Date.now()
): Progress {
  const past = lessons.filter((l) => new Date(l.end).getTime() <= now && l.attended);
  const future = lessons.filter((l) => new Date(l.end).getTime() > now);

  const done = Array.from(new Set([...range(p.affrontato), ...past.map((l) => l.level)])).sort((a, b) => a - b);
  const scheduled = future.map((l) => ({ level: l.level, lessonId: l.lessonId }));
  const target = p.atteso ?? p.affrontato;

  const next = range(target).find((l) => !done.includes(l)) ?? null;
  const recommended = pickRecommended(target, done, scheduled.map((s) => s.level));

  const top = Math.max(target, ...done, ...scheduled.map((s) => s.level), 0);
  const steps: Step[] = range(top).map((level) => {
    if (done.includes(level)) {
      const real = past.filter((l) => l.level === level).sort((a, b) => +new Date(b.end) - +new Date(a.end))[0];
      return { level, status: "done", date: real ? new Date(real.start).toISOString() : undefined };
    }
    const sch = future.filter((l) => l.level === level).sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
    if (sch) return { level, status: "scheduled", date: new Date(sch.start).toISOString() };
    return { level, status: level === next ? "next" : "todo" };
  });

  return { atteso: p.atteso, affrontato: p.affrontato, done, scheduled, next, recommended, steps };
}
