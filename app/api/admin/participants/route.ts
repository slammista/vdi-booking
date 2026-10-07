import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const rows = await query(
    `SELECT id, source_id, nome, cognome, username, tipo_utente, idoneo_prenotazione,
            is_active, must_reset_password, updated_at
     FROM participants ORDER BY cognome, nome`
  );
  return NextResponse.json({ participants: rows });
}
