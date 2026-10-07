// Parser per il CSV dei partecipanti, generato da scripts/extract_participants.py
// a partire dal report Excel. Colonne attese (l'ordine non conta; le intestazioni
// sono confrontate senza maiuscole/accenti):
//   Id, Nome, Cognome, Tipo Utente, Livello Atteso, Livello Svolto
// Le due colonne dei livelli sono facoltative. Sono accettati anche gli alias
// inglesi (externalId, firstName, lastName, userType, expectedLevel, currentLevel).
// Non esiste idoneita': chi e' nel file ha accesso all'app.

export type ParticipantRow = {
  sourceId: number;
  nome: string;
  cognome: string;
  tipoUtente: "TMI" | "External";
  /** undefined = colonna assente nel CSV (non toccare il valore nel DB) */
  livelloAtteso?: number | null;
  livelloAffrontato?: number;
};

import { MAX_LEVEL } from "./levels";

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function detectDelimiter(headerLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, headerLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Riconosce le intestazioni dei livelli in modo flessibile (es. "Livello aspettativa", "Liv. Affrontato"). */
function levelColumnKind(h: string): "atteso" | "affrontato" | null {
  const hasLevel = /liv|level/.test(h) || /^(atteso|aspettat|affrontat|svolt|raggiunt)/.test(h);
  if (!hasLevel) return null;
  if (/(attes|aspett|expect|target|obiett|previst|richiest|desider)/.test(h)) return "atteso";
  if (/(affront|svolt|compl|raggiunt|attual|current|corrent|acquisit|frequent|fatt)/.test(h)) return "affrontato";
  return null;
}

/** Converte il valore di una cella in livello: numero ("2", "Livello 2", "L2") o testo descrittivo. */
function parseLevelValue(raw: string): number | null {
  const v = normalize(raw);
  if (!v || /^([-–—_.]+|n\/?a|nd|nessuno|nessuna|no|null)$/.test(v)) return null; // "—" = nessun livello
  const digits = v.match(/[0-9]+/);
  if (digits) return Number(digits[0]);
  if (/(end.?to.?end|e2e|produzione|uat|rilascio|requisiti)/.test(v)) return 3;
  if (/(tool|applicativ|sviluppo|app\b)/.test(v)) return 2;
  if (/(prompt|base|basic|quotidian|iniziale|principiante)/.test(v)) return 1;
  return Number.NaN;
}

export type CsvReport = {
  rows: ParticipantRow[];
  /** intestazioni riconosciute per le colonne dei livelli (null = non trovata) */
  columns: { atteso: string | null; affrontato: string | null };
  /** quante righe hanno un valore in ciascuna colonna dei livelli */
  filled: { atteso: number; affrontato: number };
  /** tutte le intestazioni presenti nel file, per diagnosi */
  headers: string[];
};

export function parseParticipantsCsv(content: string): ParticipantRow[] {
  return parseParticipantsCsvDetailed(content).rows;
}

export function parseParticipantsCsvDetailed(content: string): CsvReport {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const empty: CsvReport = {
    rows: [],
    columns: { atteso: null, affrontato: null },
    filled: { atteso: 0, affrontato: 0 },
    headers: [],
  };
  if (lines.length === 0) return empty;

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  const header = rawHeaders.map(normalize);
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    id: find("id", "externalid", "external id", "source id", "sourceid"),
    nome: find("nome", "firstname", "first name"),
    cognome: find("cognome", "lastname", "last name"),
    tipo: find("tipo utente", "tipo", "usertype", "user type"),
    atteso: header.findIndex((h) => levelColumnKind(h) === "atteso"),
    affrontato: header.findIndex((h) => levelColumnKind(h) === "affrontato"),
  };

  const required: Record<string, number> = { id: idx.id, nome: idx.nome, cognome: idx.cognome, tipo: idx.tipo };
  const missing = Object.entries(required).filter(([, v]) => v === -1);
  if (missing.length > 0) {
    throw new Error(
      `Colonne mancanti nel CSV: ${missing.map(([k]) => k).join(", ")}. ` +
        `Intestazioni trovate: ${rawHeaders.join(" | ")}.`
    );
  }

  const filled = { atteso: 0, affrontato: 0 };
  const seenIds = new Set<number>();
  const rows = lines.slice(1).map((line, i) => {
    const lineNo = i + 2;
    const cols = splitCsvLine(line, delimiter);
    const sourceId = Number((cols[idx.id] ?? "").trim());
    const nome = (cols[idx.nome] ?? "").trim();
    const cognome = (cols[idx.cognome] ?? "").trim();

    if (!Number.isInteger(sourceId)) throw new Error(`Riga ${lineNo}: Id non valido.`);
    if (seenIds.has(sourceId)) throw new Error(`Riga ${lineNo}: Id ${sourceId} duplicato.`);
    if (!nome || !cognome) throw new Error(`Riga ${lineNo}: Nome o Cognome mancante.`);
    seenIds.add(sourceId);

    const level = (col: number, what: string): number | null => {
      if (col === -1) return null;
      const raw = (cols[col] ?? "").trim();
      const n = parseLevelValue(raw);
      if (n === null) return null;
      if (!Number.isInteger(n) || n < 0 || n > MAX_LEVEL) {
        throw new Error(`Riga ${lineNo}: ${what} "${raw}" non valido (valori ammessi 0-${MAX_LEVEL}).`);
      }
      return n;
    };
    const atteso0 = level(idx.atteso, "Livello Atteso");
    const atteso = atteso0 === 0 ? null : atteso0; // 0 = nessuna aspettativa
    const affrontato = level(idx.affrontato, "Livello Affrontato");
    if (atteso !== null) filled.atteso += 1;
    if (affrontato !== null) filled.affrontato += 1;

    return {
      sourceId,
      nome,
      cognome,
      tipoUtente: normalize(cols[idx.tipo] ?? "") === "tmi" ? ("TMI" as const) : ("External" as const),
      livelloAtteso: idx.atteso === -1 ? undefined : atteso,
      livelloAffrontato: idx.affrontato === -1 ? undefined : (affrontato ?? 0),
    };
  });

  return {
    rows,
    columns: {
      atteso: idx.atteso === -1 ? null : rawHeaders[idx.atteso],
      affrontato: idx.affrontato === -1 ? null : rawHeaders[idx.affrontato],
    },
    filled,
    headers: rawHeaders,
  };
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
