import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db";
import { verifyPassword, createSessionToken, COOKIES } from "@/lib/auth";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  const { username, password } = parsed.data;

  const participant = await queryOne<{
    id: number;
    nome: string;
    cognome: string;
    username: string;
    password_hash: string;
    is_active: boolean;
    must_reset_password: boolean;
  }>(
    `SELECT id, nome, cognome, username, password_hash, is_active, must_reset_password
     FROM participants WHERE username = $1`,
    [username.toLowerCase()]
  );

  // Messaggio deliberatamente generico: non rivelare se e' lo username o la
  // password ad essere sbagliati (buona pratica di sicurezza minima).
  const genericError = NextResponse.json({ error: "Nome utente o password non corretti." }, { status: 401 });

  if (!participant || !participant.is_active) return genericError;

  const ok = await verifyPassword(password, participant.password_hash);
  if (!ok) return genericError;

  const token = await createSessionToken({
    participantId: participant.id,
    username: participant.username,
    nome: participant.nome,
    cognome: participant.cognome,
  });

  const res = NextResponse.json({
    ok: true,
    mustResetPassword: participant.must_reset_password,
    nome: participant.nome,
    cognome: participant.cognome,
  });
  res.cookies.set(COOKIES.SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return res;
}
