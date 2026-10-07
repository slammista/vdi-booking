import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { dayBounds, isValidDateString } from "@/lib/slots";
import { addDays } from "@/lib/calendar";

/**
 * GET /api/bookings/range?from=YYYY-MM-DD&to=YYYY-MM-DD (to incluso)
 * Prenotazioni confermate nell'intervallo, senza dati personali degli altri
 * utenti: per ognuna solo orario e se e' dell'utente corrente.
 */
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!isValidDateString(from) || !isValidDateString(to) || to < from || to > addDays(from, 400)) {
    return NextResponse.json({ error: "Intervallo non valido." }, { status: 400 });
  }

  const resource = await queryOne<{ id: number }>(
    `SELECT id FROM vdi_resources WHERE code = $1 AND is_active = true`,
    [process.env.VDI_RESOURCE_CODE ?? "VDI-AI-01"]
  );
  if (!resource) return NextResponse.json({ error: "Risorsa VDI non configurata." }, { status: 500 });

  const rows = await query<{ id: number; participant_id: number; start: Date; end: Date }>(
    `SELECT id, participant_id, lower(slot) AS start, upper(slot) AS "end"
     FROM bookings
     WHERE resource_id = $1 AND stato = 'Confermata' AND slot && tstzrange($2, $3)
     ORDER BY lower(slot)`,
    [resource.id, dayBounds(from).start.toISOString(), dayBounds(to).end.toISOString()]
  );

  return NextResponse.json({
    bookings: rows.map((r) => ({
      id: r.id,
      start: r.start,
      end: r.end,
      mine: r.participant_id === session.participantId,
    })),
  });
}
