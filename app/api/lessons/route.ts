import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { computeProgress } from "@/lib/levels";

type Row = {
  id: number; title: string; notes: string | null; level: number; attended: boolean;
  start: Date; end: Date; participants: number;
};

/** GET /api/lessons — lezioni dell'utente, progressione per livello e prossimi step. */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const rows = await query<Row>(
    `SELECT l.id, l.title, l.notes, l.level, lp.attended, lower(l.slot) AS start, upper(l.slot) AS "end",
            (SELECT count(*) FROM lesson_participants x WHERE x.lesson_id = l.id)::int AS participants
     FROM lessons l
     JOIN lesson_participants lp ON lp.lesson_id = l.id
     WHERE lp.participant_id = $1
     ORDER BY lower(l.slot)`,
    [session.participantId]
  );
  const me = await queryOne<{ livello_atteso: number | null; livello_affrontato: number }>(
    `SELECT livello_atteso, livello_affrontato FROM participants WHERE id = $1`,
    [session.participantId]
  );

  const now = Date.now();
  const upcoming = rows.filter((r) => new Date(r.end).getTime() > now);
  const past = rows.filter((r) => new Date(r.end).getTime() <= now).reverse().slice(0, 30);
  const progress = computeProgress(
    { atteso: me?.livello_atteso ?? null, affrontato: me?.livello_affrontato ?? 0 },
    rows.map((r) => ({ lessonId: r.id, level: r.level, start: r.start, end: r.end, attended: r.attended })),
    now
  );
  return NextResponse.json({ next: upcoming[0] ?? null, upcoming, past, progress });
}
