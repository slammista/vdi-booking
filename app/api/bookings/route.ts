import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { validateBookingSlot } from "@/lib/booking-rules";

/** GET /api/bookings — prenotazioni future (non ancora concluse) dell'utente corrente. */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const rows = await query<{ id: number; start: Date; end: Date }>(
    `SELECT id, lower(slot) AS start, upper(slot) AS "end"
     FROM bookings
     WHERE participant_id = $1 AND stato = 'Confermata' AND upper(slot) > now()
     ORDER BY lower(slot)`,
    [session.participantId]
  );
  return NextResponse.json({ bookings: rows });
}

const createSchema = z.object({
  start: z.string(),
  end: z.string(),
  note: z.string().max(280).optional(),
});

/**
 * POST /api/bookings
 * Crea una prenotazione. L'esclusivita' dello slot e' garantita a livello
 * di database (vincolo EXCLUDE su bookings, vedi schema.sql): se un altro
 * utente ha gia' prenotato esattamente lo stesso istante, questa chiamata
 * fallisce con 409, anche in caso di richieste quasi simultanee.
 */
export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  // Validazione lato server delle regole di business (oltre a quelle di UI):
  // mai fidarsi solo del client per orari/giorni ammessi.
  const slot = validateBookingSlot(parsed.data.start, parsed.data.end);
  if (!slot.ok) return NextResponse.json({ error: slot.error }, { status: 400 });

  const resource = await queryOne<{ id: number }>(
    `SELECT id FROM vdi_resources WHERE code = $1 AND is_active = true`,
    [process.env.VDI_RESOURCE_CODE ?? "VDI-AI-01"]
  );
  if (!resource) return NextResponse.json({ error: "Risorsa VDI non configurata." }, { status: 500 });

  try {
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO bookings (participant_id, resource_id, slot, note)
       VALUES ($1, $2, tstzrange($3, $4), $5)
       RETURNING id`,
      [session.participantId, resource.id, slot.start.toISOString(), slot.end.toISOString(), parsed.data.note ?? null]
    );
    return NextResponse.json({ ok: true, bookingId: inserted?.id }, { status: 201 });
  } catch (err: any) {
    // 23P01 = exclusion_violation: un'altra prenotazione occupa gia' lo slot.
    if (err?.code === "23P01") {
      return NextResponse.json(
        { error: "Questo slot è stato appena prenotato da un altro utente. Scegline un altro." },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Errore durante la prenotazione." }, { status: 500 });
  }
}
