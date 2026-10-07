// Parser minimale per il CSV esportato dal foglio "DB_Partecipanti" del
// report Excel generato dall'agente (Fase 1). Formato atteso (intestazioni
// in italiano, coerenti con l'export da Excel):
//   Id,Nome,Cognome,Tipo Utente,Idoneo Prenotazione VDI

export type ParticipantRow = {
  sourceId: number;
  nome: string;
  cognome: string;
  tipoUtente: "TMI" | "External";
  idoneo: boolean;
};

export function parseParticipantsCsv(content: string): ParticipantRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    id: header.indexOf("id"),
    nome: header.indexOf("nome"),
    cognome: header.indexOf("cognome"),
    tipo: header.indexOf("tipo utente"),
    idoneo: header.indexOf("idoneo prenotazione vdi"),
  };

  const missing = Object.entries(idx).filter(([, v]) => v === -1);
  if (missing.length > 0) {
    throw new Error(
      `Colonne mancanti nel CSV: ${missing.map(([k]) => k).join(", ")}. ` +
        "Verifica di aver esportato il foglio DB_Partecipanti senza modificare le intestazioni."
    );
  }

  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const tipoRaw = (cols[idx.tipo] ?? "").trim();
    return {
      sourceId: Number(cols[idx.id]),
      nome: (cols[idx.nome] ?? "").trim(),
      cognome: (cols[idx.cognome] ?? "").trim(),
      tipoUtente: tipoRaw === "TMI" ? "TMI" : "External",
      idoneo: /^s(i|ì)$/i.test((cols[idx.idoneo] ?? "").trim()),
    };
  });
}

/** Split di una riga CSV con supporto minimo per valori tra virgolette. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
