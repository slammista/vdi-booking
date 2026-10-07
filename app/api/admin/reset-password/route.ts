import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth";

const schema = z.object({ participantId: z.number().int() });

/**
 * POST /api/admin/reset-password
 * Genera una nuova password temporanea per un partecipante che l'ha
 * dimenticata. La password in chiaro viene restituita UNA SOLA VOLTA nella
 * risposta (da comunicare manualmente, fuori dall'app) e mai salvata
 * altrove: nel database resta solo il suo hash.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const tempPassword = generateTemporaryPassword();
  const hash = await hashPassword(tempPassword);

  const result = await pool.query(
    `UPDATE participants SET password_hash = $1, must_reset_password = true, updated_at = now()
     WHERE id = $2`,
    [hash, parsed.data.participantId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Partecipante non trovato." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, temporaryPassword: tempPassword });
}
