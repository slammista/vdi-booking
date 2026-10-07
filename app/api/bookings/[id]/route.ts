import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { validateBookingSlot } from "@/lib/booking-rules";
import { getCurrentSession } from "@/lib/session";

/**
 * DELETE /api/bookings/:id
 * Annulla una prenotazione. Consentito solo al proprietario della
 * prenotazione stessa (nessun amministratore puo' cancellarla da qui;
 * per quello si veda il pannello admin separato, se necessario in futuro).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const { id: rawId } = await params;
  const id = Number(rawId);
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

const moveSchema = z.object({ start: z.string(), end: z.string() });

/**
 * PATCH /api/bookings/:id — sposta una propria prenotazione futura su un altro
 * slot. L'UPDATE e' atomico: se il nuovo slot e' occupato, il vincolo EXCLUDE
 * del database lo rifiuta (409) e la prenotazione originale resta invariata.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id non valido." }, { status: 400 });

  const parsed = moveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const slot = validateBookingSlot(parsed.data.start, parsed.data.end);
  if (!slot.ok) return NextResponse.json({ error: slot.error }, { status: 400 });

  try {
    const result = await pool.query(
      `UPDATE bookings SET slot = tstzrange($1, $2)
       WHERE id = $3 AND participant_id = $4 AND stato = 'Confermata' AND lower(slot) > now()`,
      [slot.start.toISOString(), slot.end.toISOString(), id, session.participantId]
    );
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Prenotazione non trovata, annullata, già iniziata o non di tua proprietà." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "23P01") {
      return NextResponse.json(
        { error: "Il nuovo slot è appena stato prenotato da un altro utente. Scegline un altro." },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Errore durante lo spostamento." }, { status: 500 });
  }
}
