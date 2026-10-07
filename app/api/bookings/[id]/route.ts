import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

/**
 * DELETE /api/bookings/:id
 * Annulla una prenotazione. Consentito solo al proprietario della
 * prenotazione stessa (nessun amministratore puo' cancellarla da qui;
 * per quello si veda il pannello admin separato, se necessario in futuro).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id non valido." }, { status: 400 });

  const result = await pool.query(
    `UPDATE bookings SET stato = 'Annullata'
     WHERE id = $1 AND participant_id = $2 AND stato = 'Confermata'`,
    [id, session.participantId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: "Prenotazione non trovata, già annullata, o non di tua proprietà." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
