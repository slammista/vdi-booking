import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { decryptPassword } from "@/lib/vault";

/** POST /api/admin/participants/:id/password — mostra la password attuale (se nota). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id non valido." }, { status: 400 });

  const row = await queryOne<{ password_enc: string | null }>(`SELECT password_enc FROM participants WHERE id = $1`, [id]);
  if (!row) return NextResponse.json({ error: "Partecipante non trovato." }, { status: 404 });

  const res = NextResponse.json({ password: decryptPassword(row.password_enc) });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
