import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { computeProgress, type LessonRef } from "@/lib/levels";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const rows = await query<any>(
    `SELECT id, source_id, nome, cognome, username, tipo_utente, idoneo_prenotazione,
            is_active, must_reset_password, updated_at, livello_atteso, livello_affrontato,
            (password_enc IS NOT NULL) AS has_password
     FROM participants ORDER BY cognome, nome`
  );
  const lessonRows = await query<any>(
    `SELECT lp.participant_id, lp.lesson_id, lp.attended, l.level, lower(l.slot) AS start, upper(l.slot) AS "end"
     FROM lesson_participants lp JOIN lessons l ON l.id = lp.lesson_id`
  );
  const byPerson = new Map<number, LessonRef[]>();
  for (const r of lessonRows) {
    const list = byPerson.get(r.participant_id) ?? [];
    list.push({ lessonId: r.lesson_id, level: r.level, start: r.start, end: r.end, attended: r.attended });
    byPerson.set(r.participant_id, list);
  }

  const participants = rows.map((p) => {
    const progress = computeProgress(
      { atteso: p.livello_atteso, affrontato: p.livello_affrontato },
      byPerson.get(p.id) ?? []
    );
    return {
      ...p,
      done: progress.done,
      scheduled: progress.scheduled,
      next: progress.next,
      recommended: progress.recommended,
    };
  });
  return NextResponse.json({ participants });
}
