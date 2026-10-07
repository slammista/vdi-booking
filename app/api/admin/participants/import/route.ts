import { NextRequest, NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { parseParticipantsCsvDetailed } from "@/lib/csv";
import { buildUsername, generateTemporaryPassword, hashPassword } from "@/lib/auth";
import { encryptPassword } from "@/lib/vault";

/**
 * POST /api/admin/participants/import
 * Riceve il CSV esportato dal foglio "DB_Partecipanti" (generato
 * automaticamente dall'agente della Fase 1) e sincronizza la tabella
 * participants:
 *  - nuove persone -> creato username + password temporanea (mostrata UNA
 *    SOLA VOLTA nella risposta, da comunicare manualmente fuori dall'app)
 *  - persone esistenti (stesso source_id) -> aggiornati nome/cognome/tipo/livelli
 *  - persone non piu' presenti nel CSV -> is_active = false (non cancellate,
 *    per preservare lo storico delle prenotazioni passate)
 *
 * Nessun dato aziendale viene mai letto o scritto: il CSV contiene solo
 * Id, Nome, Cognome, Tipo Utente e (facoltativi) i livelli atteso/svolto.
 * Essere presenti nel file significa avere accesso: non esiste un flag di idoneita'.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "File CSV mancante." }, { status: 400 });
  }

  const content = await (file as File).text();
  let rows;
  let report;
  try {
    report = parseParticipantsCsvDetailed(content);
    rows = report.rows;
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "CSV non valido." }, { status: 400 });
  }

  const existingUsernames = new Set(
    (await query<{ username: string }>(`SELECT username FROM participants`)).map((r) => r.username)
  );
  const existingBySourceId = new Map(
    (await query<{ id: number; source_id: number }>(`SELECT id, source_id FROM participants`)).map((r) => [
      r.source_id,
      r.id,
    ])
  );

  const client = await pool.connect();
  const created: { nome: string; cognome: string; username: string; temporaryPassword: string }[] = [];
  const updatedIds: number[] = [];

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const existingId = existingBySourceId.get(row.sourceId);
      if (existingId) {
        // I livelli si aggiornano solo se le colonne sono presenti nel CSV.
        await client.query(
          `UPDATE participants
           SET nome = $1, cognome = $2, tipo_utente = $3,
               livello_atteso = CASE WHEN $5 THEN $6::smallint ELSE livello_atteso END,
               livello_affrontato = CASE WHEN $7 THEN $8::smallint ELSE livello_affrontato END,
               is_active = true, updated_at = now()
           WHERE id = $4`,
          [
            row.nome, row.cognome, row.tipoUtente, existingId,
            row.livelloAtteso !== undefined, row.livelloAtteso ?? null,
            row.livelloAffrontato !== undefined, row.livelloAffrontato ?? 0,
          ]
        );
        updatedIds.push(existingId);
      } else {
        const username = buildUsername(row.nome, row.cognome, existingUsernames);
        const tempPassword = generateTemporaryPassword();
        const passwordHash = await hashPassword(tempPassword);

        await client.query(
          `INSERT INTO participants
             (source_id, nome, cognome, username, tipo_utente,
              password_hash, password_enc, must_reset_password, is_active,
              livello_atteso, livello_affrontato)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, $8, $9)`,
          [
            row.sourceId, row.nome, row.cognome, username, row.tipoUtente,
            passwordHash, encryptPassword(tempPassword),
            row.livelloAtteso ?? null, row.livelloAffrontato ?? 0,
          ]
        );

        created.push({ nome: row.nome, cognome: row.cognome, username, temporaryPassword: tempPassword });
      }
    }

    // Disattiva chi non è più presente nel CSV (non cancella, per preservare lo storico)
    const seenSourceIds = rows.map((r) => r.sourceId);
    if (seenSourceIds.length > 0) {
      await client.query(
        `UPDATE participants SET is_active = false, updated_at = now()
         WHERE source_id <> ALL($1::int[])`,
        [seenSourceIds]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return NextResponse.json({ error: "Errore durante la sincronizzazione." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({
    ok: true,
    totalRows: rows.length,
    created,
    updatedCount: updatedIds.length,
    // cosa e' stato effettivamente letto dal file (per verificare le colonne dei livelli)
    detected: { columns: report.columns, filled: report.filled, headers: report.headers },
  });
}
