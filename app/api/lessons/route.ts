import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

type Row = { id: number; title: string; notes: string | null; start: Date; end: Date; participants: number };

/** GET /api/lessons — lezioni assegnate all'utente: la prossima, quelle future e le ultime passate. */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const rows = await query<Row>(
    `SELECT l.id, l.title, l.notes, lower(l.slot) AS start, upper(l.slot) AS "end",
            (SELECT count(*) FROM lesson_participants x WHERE x.lesson_id = l.id)::int AS participants
     FROM lessons l
     JOIN lesson_participants lp ON lp.lesson_id = l.id
     WHERE lp.participant_id = $1
     ORDER BY lower(l.slot)`,
    [session.participantId]
  );

  const now = Date.now();
  const upcoming = rows.filter((r) => new Date(r.end).getTime() > now);
  const past = rows.filter((r) => new Date(r.end).getTime() <= now).reverse().slice(0, 20);
  return NextResponse.json({ next: upcoming[0] ?? null, upcoming, past });
}
