import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { dayBounds, generateDaySlots, isValidDateString, romeDateString } from "@/lib/slots";

/**
 * GET /api/bookings?date=YYYY-MM-DD
 * Ritorna gli slot della giornata richiesta con lo stato di disponibilita'
 * (libero / occupato), piu' le prenotazioni dell'utente corrente.
 */
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) return NextResponse.json({ error: "Parametro 'date' mancante." }, { status: 400 });

  if (!isValidDateString(dateParam)) {
    return NextResponse.json({ error: "Data non valida." }, { status: 400 });
  }

  const slots = generateDaySlots(dateParam);

  const resource = await queryOne<{ id: number }>(
    `SELECT id FROM vdi_resources WHERE code = $1 AND is_active = true`,
    [process.env.VDI_RESOURCE_CODE ?? "VDI-AI-01"]
  );
  if (!resource) {
    return NextResponse.json({ error: "Risorsa VDI non configurata." }, { status: 500 });
  }

  const { start: dayStart, end: dayEnd } = dayBounds(dateParam);

  const existing = await query<{
    id: number;
    participant_id: number;
    slot_start: string;
    slot_end: string;
    nome: string;
    cognome: string;
  }>(
    `SELECT b.id, b.participant_id, lower(b.slot) AS slot_start, upper(b.slot) AS slot_end,
            p.nome, p.cognome
     FROM bookings b
     JOIN participants p ON p.id = b.participant_id
     WHERE b.resource_id = $1 AND b.stato = 'Confermata'
       AND b.slot && tstzrange($2, $3)`,
    [resource.id, dayStart.toISOString(), dayEnd.toISOString()]
  );

  const result = slots.map((slot) => {
    const match = existing.find(
      (b) => new Date(b.slot_start).getTime() === slot.start.getTime()
    );
    const isMine = match?.participant_id === session.participantId;
    return {
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      label: slot.label,
      status: !match ? "free" : isMine ? "mine" : "taken",
      bookingId: isMine ? match?.id : undefined,
    };
  });

  return NextResponse.json({ date: dateParam, resourceCode: process.env.VDI_RESOURCE_CODE ?? "VDI-AI-01", slots: result });
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

  const { start, end, note } = parsed.data;
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Validazione lato server delle regole di business (oltre a quelle di UI):
  // mai fidarsi solo del client per orari/giorni ammessi.
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  const slotsOfDay = generateDaySlots(romeDateString(startDate));
  const matchesKnownSlot = slotsOfDay.some(
    (s) => s.start.getTime() === startDate.getTime() && s.end.getTime() === endDate.getTime()
  );
  if (!matchesKnownSlot) {
    return NextResponse.json(
      { error: "Lo slot richiesto non rientra negli orari prenotabili (09:00-18:00, lun-ven, festività escluse)." },
      { status: 400 }
    );
  }

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
      [session.participantId, resource.id, startDate.toISOString(), endDate.toISOString(), note ?? null]
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
