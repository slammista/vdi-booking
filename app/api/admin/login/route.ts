import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSessionToken, COOKIES } from "@/lib/auth";

const schema = z.object({ password: z.string().min(1) });

/**
 * Login amministratore separato da quello dei partecipanti: una singola
 * password condivisa, nota solo a te, impostata in ADMIN_PASSWORD (env var).
 * Nessuna email, nessun account aziendale coinvolto.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD non configurata sul server." }, { status: 500 });
  }

  if (parsed.data.password !== adminPassword) {
    return NextResponse.json({ error: "Password errata." }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIES.ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return res;
}
