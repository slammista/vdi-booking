import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import type { PoolClient } from "pg";
import { isBookableDay } from "./holidays";
import {
  BOOKING_HORIZON_END,
  DAY_END_HOUR,
  DAY_START_HOUR,
  TIMEZONE,
  isValidDateString,
} from "./slots";

export class LessonError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const lessonInputSchema = z.object({
  title: z.string().trim().min(1, "Titolo mancante.").max(120),
  notes: z.string().trim().max(500).nullish(),
  date: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(15).max(9 * 60),
  participantIds: z.array(z.number().int().positive()).min(1, "Seleziona almeno un partecipante.").max(300),
});
export type LessonInput = z.infer<typeof lessonInputSchema>;

/** Traduce data+ora+durata (ora di Roma) in un intervallo, validando le regole di business. */
export function resolveLessonSlot(input: LessonInput): { start: Date; end: Date } {
  if (!isValidDateString(input.date)) throw new LessonError(400, "Data non valida.");
  if (!isBookableDay(input.date)) throw new LessonError(400, "Le lezioni sono possibili solo dal lunedì al venerdì, esclusi i festivi.");
  if (input.date > BOOKING_HORIZON_END) throw new LessonError(400, "Data oltre il limite di programmazione.");

  const [hh, mm] = input.startTime.split(":").map(Number);
  if (hh > 23 || mm > 59 || mm % 15 !== 0) throw new LessonError(400, "L'orario di inizio deve essere a multipli di 15 minuti.");
  const startMin = hh * 60 + mm;
  const endMin = startMin + input.durationMinutes;
  if (startMin < DAY_START_HOUR * 60 || endMin > DAY_END_HOUR * 60) {
    throw new LessonError(400, `La lezione deve stare tra le ${DAY_START_HOUR}:00 e le ${DAY_END_HOUR}:00.`);
  }
  const at = (m: number) =>
    fromZonedTime(`${input.date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`, TIMEZONE);
  return { start: at(startMin), end: at(endMin) };
}

/** Crea (id null) o aggiorna una lezione e i suoi partecipanti, in transazione. */
export async function saveLesson(client: PoolClient, id: number | null, input: LessonInput): Promise<number> {
  const { start, end } = resolveLessonSlot(input);
  const ids = Array.from(new Set(input.participantIds));

  await client.query("BEGIN");
  try {
    const valid = await client.query(`SELECT id FROM participants WHERE id = ANY($1::int[]) AND is_active`, [ids]);
    if (valid.rowCount !== ids.length) throw new LessonError(400, "Uno o più partecipanti non esistono o non sono attivi.");

    const clash = await client.query(
      `SELECT DISTINCT p.nome, p.cognome
       FROM lesson_participants lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN participants p ON p.id = lp.participant_id
       WHERE lp.participant_id = ANY($1::int[]) AND l.slot && tstzrange($2, $3)
         AND ($4::int IS NULL OR l.id <> $4)`,
      [ids, start.toISOString(), end.toISOString(), id]
    );
    if (clash.rowCount) {
      const names = clash.rows.map((r) => `${r.nome} ${r.cognome}`).join(", ");
      throw new LessonError(409, `Sovrapposizione con un'altra lezione già assegnata a: ${names}.`);
    }

    let lessonId = id;
    if (id === null) {
      const ins = await client.query(
        `INSERT INTO lessons (title, notes, slot) VALUES ($1, $2, tstzrange($3, $4)) RETURNING id`,
        [input.title, input.notes || null, start.toISOString(), end.toISOString()]
      );
      lessonId = ins.rows[0].id;
    } else {
      const upd = await client.query(
        `UPDATE lessons SET title = $1, notes = $2, slot = tstzrange($3, $4), updated_at = now() WHERE id = $5`,
        [input.title, input.notes || null, start.toISOString(), end.toISOString(), id]
      );
      if (upd.rowCount === 0) throw new LessonError(404, "Lezione non trovata.");
      await client.query(`DELETE FROM lesson_participants WHERE lesson_id = $1`, [id]);
    }

    await client.query(
      `INSERT INTO lesson_participants (lesson_id, participant_id) SELECT $1, unnest($2::int[])`,
      [lessonId, ids]
    );
    await client.query("COMMIT");
    return lessonId as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}
