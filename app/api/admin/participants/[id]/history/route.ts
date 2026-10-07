import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool, query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { computeProgress, type LessonRef } from "@/lib/levels";

type Ctx = { params: Promise<{ id: string }> };

/** GET: storico lezioni e progressione di un partecipante. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id non valido." }, { status: 400 });

  const p = await queryOne<any>(
    `SELECT id, nome, cognome, livello_atteso, livello_affrontato FROM participants WHERE id = $1`,
    [id]
  );
  if (!p) return NextResponse.json({ error: "Partecipante non trovato." }, { status: 404 });

  const lessons = await query<any>(
    `SELECT l.id AS lesson_id, l.title, l.level, lp.attended, lower(l.slot) AS start, upper(l.slot) AS "end"
     FROM lesson_participants lp JOIN lessons l ON l.id = lp.lesson_id
     WHERE lp.participant_id = $1 ORDER BY lower(l.slot) DESC`,
    [id]
  );
  const refs: LessonRef[] = lessons.map((l) => ({
    lessonId: l.lesson_id, level: l.level, start: l.start, end: l.end, attended: l.attended,
  }));
  const progress = computeProgress({ atteso: p.livello_atteso, affrontato: p.livello_affrontato }, refs);
  return NextResponse.json({ participant: p, lessons, progress });
}

const schema = z.object({ lessonId: z.number().int(), attended: z.boolean() });

/** PATCH: segna presente/assente a una lezione (un'assenza non fa avanzare di livello). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  const id = Number((await ctx.params).id);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const r = await pool.query(
    `UPDATE lesson_participants SET attended = $1 WHERE participant_id = $2 AND lesson_id = $3`,
    [parsed.data.attended, id, parsed.data.lessonId]
  );
  if (r.rowCount === 0) return NextResponse.json({ error: "Lezione non trovata per questo partecipante." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
