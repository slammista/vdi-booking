#!/usr/bin/env python3
"""
Estrae i partecipanti dal report Excel (AI_LAB_Report_Manageriale_*.xlsx) e
genera il CSV da caricare nel pannello admin ("Partecipanti -> Sincronizza").

Colonne prodotte:  Id, Nome, Cognome, Tipo Utente, Livello Atteso, Livello Svolto

Origine dei dati (cercati per NOME di colonna, non per posizione):
  - foglio Dati_Persone         : ID, Nome, Cognome, Tipo Utente, Aspettativa Livello
  - foglio Stato_Partecipanti   : ID, Livello attuale   ("—" o vuoto = nessun livello svolto = 0)

Non c'e' alcuna colonna di idoneita': chi e' presente nel file ha accesso all'app.

Uso:
    pip install openpyxl
    python scripts/extract_participants.py AI_LAB_Report_Manageriale_2026-10-01.xlsx
    python scripts/extract_participants.py report.xlsx -o partecipanti.csv

Il CSV contiene dati personali (nomi): NON committarlo nel repository.
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("Manca openpyxl: esegui  pip install openpyxl")

MAX_LEVEL = 3  # tenere allineato con lib/levels.ts
SHEET_PEOPLE = "Dati_Persone"
SHEET_STATUS = "Stato_Partecipanti"


def norm(value: object) -> str:
    """Minuscolo, senza accenti e senza spazi/punteggiatura: per confrontare le intestazioni."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", text.lower())


def read_table(ws, required: list[str]) -> list[dict]:
    """Trova la riga d'intestazione (contiene tutte le colonne richieste) e ritorna le righe come dict."""
    rows = list(ws.iter_rows(values_only=True))
    for i, row in enumerate(rows):
        headers = [norm(c) for c in row]
        if all(norm(r) in headers for r in required):
            out = []
            for data in rows[i + 1 :]:
                if all(v is None or str(v).strip() == "" for v in data):
                    continue
                out.append({headers[j]: v for j, v in enumerate(data) if headers[j]})
            return out
    sys.exit(f"Foglio '{ws.title}': intestazioni non trovate (attese: {', '.join(required)}).")


def pick(row: dict, *names: str):
    for n in names:
        if norm(n) in row:
            return row[norm(n)]
    return None


def parse_level(value: object, *, what: str, ident: object, warnings: list[str], allow_blank: bool) -> int | None:
    """Converte una cella in livello 0..MAX_LEVEL. '—', '-', vuoto -> 0 (o None se allow_blank)."""
    text = str(value).strip() if value is not None else ""
    if text in ("", "—", "–", "-", "--") or text.lower() in ("n/a", "nd", "nessuno", "none"):
        return None if allow_blank else 0
    match = re.search(r"\d+", text)
    if not match:
        warnings.append(f"ID {ident}: {what} '{text}' non numerico: ignorato.")
        return None if allow_blank else 0
    level = int(match.group())
    if not 0 <= level <= MAX_LEVEL:
        warnings.append(f"ID {ident}: {what} {level} fuori range 0-{MAX_LEVEL}: ignorato.")
        return None if allow_blank else 0
    return level


def parse_type(value: object, ident: object, warnings: list[str]) -> str:
    text = str(value or "").strip().lower()
    if text == "tmi":
        return "TMI"
    if text == "external":
        return "External"
    warnings.append(f"ID {ident}: Tipo Utente '{value}' non riconosciuto (atteso TMI/External): impostato External.")
    return "External"


def main() -> None:
    ap = argparse.ArgumentParser(description="Estrae i partecipanti dal report Excel AI LAB in CSV per l'app VDI.")
    ap.add_argument("xlsx", type=Path, help="Percorso del file AI_LAB_Report_Manageriale_*.xlsx")
    ap.add_argument("-o", "--output", type=Path, help="CSV di output (default: partecipanti_AAAA-MM-GG.csv)")
    args = ap.parse_args()

    if not args.xlsx.exists():
        sys.exit(f"File non trovato: {args.xlsx}")
    wb = openpyxl.load_workbook(args.xlsx, data_only=True, read_only=True)
    for sheet in (SHEET_PEOPLE, SHEET_STATUS):
        if sheet not in wb.sheetnames:
            sys.exit(f"Foglio '{sheet}' non presente. Fogli trovati: {', '.join(wb.sheetnames)}")

    people = read_table(wb[SHEET_PEOPLE], ["ID", "Nome", "Cognome", "Tipo Utente"])
    status = {}
    for row in read_table(wb[SHEET_STATUS], ["ID", "Livello attuale"]):
        status[str(pick(row, "ID")).strip()] = row

    warnings: list[str] = []
    out_rows: list[list] = []
    seen: set[str] = set()
    for row in people:
        raw_id = pick(row, "ID")
        ident = str(raw_id).strip() if raw_id is not None else ""
        if not ident.isdigit():
            warnings.append(f"Riga saltata: ID '{raw_id}' non valido.")
            continue
        if ident in seen:
            warnings.append(f"ID {ident}: duplicato, riga saltata.")
            continue
        seen.add(ident)

        nome = str(pick(row, "Nome") or "").strip()
        cognome = str(pick(row, "Cognome") or "").strip()
        if not nome or not cognome:
            warnings.append(f"ID {ident}: Nome o Cognome mancante, riga saltata.")
            continue

        tipo = parse_type(pick(row, "Tipo Utente"), ident, warnings)
        atteso = parse_level(
            pick(row, "Aspettativa Livello", "Aspettativa"), what="Aspettativa", ident=ident, warnings=warnings, allow_blank=True
        )
        if ident not in status:
            warnings.append(f"ID {ident}: assente in {SHEET_STATUS}: Livello Svolto = 0.")
        svolto = parse_level(
            pick(status.get(ident, {}), "Livello attuale"), what="Livello attuale", ident=ident, warnings=warnings, allow_blank=False
        )
        out_rows.append([int(ident), nome, cognome, tipo, "" if atteso is None else atteso, svolto])

    if not out_rows:
        sys.exit("Nessun partecipante estratto.")

    out = args.output or Path(f"partecipanti_{date.today().isoformat()}.csv")
    # utf-8-sig: Excel apre correttamente gli accenti; l'app ignora il BOM.
    with open(out, "w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.writer(fh)
        writer.writerow(["Id", "Nome", "Cognome", "Tipo Utente", "Livello Atteso", "Livello Svolto"])
        writer.writerows(sorted(out_rows, key=lambda r: r[0]))

    tmi = sum(1 for r in out_rows if r[3] == "TMI")
    print(f"OK: {len(out_rows)} partecipanti ({tmi} TMI, {len(out_rows) - tmi} External) -> {out}")
    print("Livello Atteso :", {l: sum(1 for r in out_rows if r[4] == l) for l in sorted({r[4] for r in out_rows}, key=str)})
    print("Livello Svolto :", {l: sum(1 for r in out_rows if r[5] == l) for l in sorted({r[5] for r in out_rows})})
    for w in warnings:
        print("ATTENZIONE:", w)


if __name__ == "__main__":
    main()
