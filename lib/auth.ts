import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

// -----------------------------------------------------------------------
// Password: MAI salvate in chiaro. bcryptjs e' puro JavaScript (nessuna
// dipendenza nativa da compilare), quindi funziona senza problemi sia in
// locale sia nelle funzioni serverless di Vercel.
// -----------------------------------------------------------------------
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Genera una password temporanea leggibile (facile da comunicare a voce/chat). */
export function generateTemporaryPassword(): string {
  const words = ["Lab", "Orbit", "Delta", "Nova", "Pixel", "Lume", "Vega", "Echo"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${word}${digits}`;
}

// -----------------------------------------------------------------------
// Sessione: JWT firmato in un cookie httpOnly. Usiamo 'jose' (non
// 'jsonwebtoken') perche' e' compatibile con l'Edge Runtime, necessario
// per leggere la sessione dentro middleware.ts.
// -----------------------------------------------------------------------
const SESSION_COOKIE = "vdi_session";
const ADMIN_COOKIE = "vdi_admin_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET non impostata (genera una stringa casuale lunga e mettila nelle env var).");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  participantId: number;
  username: string;
  nome: string;
  cognome: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createAdminSessionToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.admin === true;
  } catch {
    return false;
  }
}

export const COOKIES = { SESSION_COOKIE, ADMIN_COOKIE };

// -----------------------------------------------------------------------
// Username: generato da nome + cognome (slug ASCII), con suffisso
// numerico progressivo in caso di omonimia. Nessuna email coinvolta.
// -----------------------------------------------------------------------
export function slugifyName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove accenti
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function buildUsername(nome: string, cognome: string, existing: Set<string>): string {
  const base = `${slugifyName(nome)}.${slugifyName(cognome)}`;
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}
