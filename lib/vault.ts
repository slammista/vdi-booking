import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Le password restano verificate tramite hash bcrypt. In aggiunta, su richiesta
// dell'amministrazione, l'ultima password nota viene conservata CIFRATA
// (AES-256-GCM) per poterla mostrare agli admin. La chiave deriva da
// SESSION_SECRET: se lo si cambia, le password salvate non sono piu' leggibili
// (il login continua a funzionare) finche' non vengono reimpostate.
function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET non impostata.");
  return createHash("sha256").update(`vdi-password-vault:${secret}`).digest();
}

export function encryptPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptPassword(stored: string | null): string | null {
  if (!stored) return null;
  try {
    const buf = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
