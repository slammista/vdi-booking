import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth";
import { encryptPassword } from "@/lib/vault";

const schema = z.object({ participantId: z.number().int() });

/**
 * POST /api/admin/reset-password
 * Genera una nuova password temporanea per un partecipante che l'ha
 * dimenticata. La password viene restituita nella risposta (da comunicare
 * manualmente, fuori dall'app); nel database restano l'hash bcrypt e una
 * copia cifrata consultabile dagli admin (vedi lib/vault.ts).
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const tempPassword = generateTemporaryPassword();
  const hash = await hashPassword(tempPassword);

  const result = await pool.query(
    `UPDATE participants SET password_hash = $1, password_enc = $3, must_reset_password = true, updated_at = now()
     WHERE id = $2`,
    [hash, parsed.data.participantId, encryptPassword(tempPassword)]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Partecipante non trovato." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, temporaryPassword: tempPassword });
}
