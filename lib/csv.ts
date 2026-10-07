// Parser per il CSV esportato dal foglio "DB_Partecipanti" del report Excel
// generato dall'agente (Fase 1). Colonne attese (l'ordine non conta, le
// intestazioni sono confrontate senza maiuscole/accenti):
//   Id, Nome, Cognome, Tipo Utente, Idoneo Prenotazione VDI
//
// Tollerante verso gli export di Excel: BOM UTF-8, separatore "," / ";" /
// tab, e per "Idoneo" accetta si/sì/s/yes/y/true/vero/1/x (anche se
// l'accento e' stato rovinato da una codifica non UTF-8).

export type ParticipantRow = {
  sourceId: number;
  nome: string;
  cognome: string;
  tipoUtente: "TMI" | "External";
  idoneo: boolean;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Valori "vero". Il carattere U+FFFD copre una "ì" rovinata dalla codifica. */
function parseYes(raw: string): boolean {
  const v = normalize(raw);
  return /^(s|si|s�|y|yes|true|vero|x|ok|1)$/.test(v);
}

function detectDelimiter(headerLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, headerLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function parseParticipantsCsv(content: string): ParticipantRow[] {
  const lines = content
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const header = splitCsvLine(lines[0], delimiter).map(normalize);
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    id: find("id"),
    nome: find("nome"),
    cognome: find("cognome"),
    tipo: find("tipo utente"),
    idoneo: find("idoneo prenotazione vdi", "idoneo"),
  };

  const missing = Object.entries(idx).filter(([, v]) => v === -1);
  if (missing.length > 0) {
    throw new Error(
      `Colonne mancanti nel CSV: ${missing.map(([k]) => k).join(", ")}. ` +
        "Verifica di aver esportato il foglio DB_Partecipanti senza modificare le intestazioni."
    );
  }

  const seenIds = new Set<number>();
  return lines.slice(1).map((line, i) => {
    const lineNo = i + 2;
    const cols = splitCsvLine(line, delimiter);
    const sourceId = Number((cols[idx.id] ?? "").trim());
    const nome = (cols[idx.nome] ?? "").trim();
    const cognome = (cols[idx.cognome] ?? "").trim();

    if (!Number.isInteger(sourceId)) throw new Error(`Riga ${lineNo}: Id non valido.`);
    if (seenIds.has(sourceId)) throw new Error(`Riga ${lineNo}: Id ${sourceId} duplicato.`);
    if (!nome || !cognome) throw new Error(`Riga ${lineNo}: Nome o Cognome mancante.`);
    seenIds.add(sourceId);

    return {
      sourceId,
      nome,
      cognome,
      tipoUtente: normalize(cols[idx.tipo] ?? "") === "tmi" ? "TMI" : "External",
      idoneo: parseYes(cols[idx.idoneo] ?? ""),
    };
  });
}

/** Split di una riga CSV con supporto minimo per valori tra virgolette. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
