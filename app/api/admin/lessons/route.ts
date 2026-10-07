import { NextRequest, NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { LessonError, lessonInputSchema, saveLesson } from "@/lib/lessons";
import { dayBounds, isValidDateString } from "@/lib/slots";
import { addDays } from "@/lib/calendar";

/** GET /api/admin/lessons?from=YYYY-MM-DD&to=YYYY-MM-DD (to incluso, max ~400 giorni) */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!isValidDateString(from) || !isValidDateString(to) || to < from || to > addDays(from, 400)) {
    return NextResponse.json({ error: "Intervallo non valido." }, { status: 400 });
  }

  const lessons = await query(
    `SELECT l.id, l.title, l.notes, l.level, lower(l.slot) AS start, upper(l.slot) AS "end",
            COALESCE(json_agg(json_build_object('id', p.id, 'nome', p.nome, 'cognome', p.cognome, 'attended', lp.attended)
                              ORDER BY p.cognome, p.nome) FILTER (WHERE p.id IS NOT NULL), '[]') AS participants
     FROM lessons l
     LEFT JOIN lesson_participants lp ON lp.lesson_id = l.id
     LEFT JOIN participants p ON p.id = lp.participant_id
     WHERE l.slot && tstzrange($1, $2)
     GROUP BY l.id ORDER BY lower(l.slot)`,
    [dayBounds(from).start.toISOString(), dayBounds(to).end.toISOString()]
  );
  return NextResponse.json({ lessons });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const parsed = lessonInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Richiesta non valida." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const id = await saveLesson(client, null, parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    if (e instanceof LessonError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Errore durante il salvataggio della lezione." }, { status: 500 });
  } finally {
    client.release();
  }
}
