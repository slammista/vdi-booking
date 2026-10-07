import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { encryptPassword } from "@/lib/vault";

const schema = z.object({
  newPassword: z.string().min(8, "La password deve avere almeno 8 caratteri."),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Richiesta non valida." }, { status: 400 });
  }

  const hash = await hashPassword(parsed.data.newPassword);
  await pool.query(
    `UPDATE participants SET password_hash = $1, password_enc = $3, must_reset_password = false, updated_at = now() WHERE id = $2`,
    [hash, session.participantId, encryptPassword(parsed.data.newPassword)]
  );

  return NextResponse.json({ ok: true });
}
