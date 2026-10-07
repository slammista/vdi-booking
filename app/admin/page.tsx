"use client";

import * as React from "react";
import { Upload, KeyRound, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonsAdmin } from "@/components/admin/lessons-admin";
import { HistoryDialog, PasswordCell } from "@/components/admin/participant-tools";
import { AdminWiki } from "@/components/wiki/admin-wiki";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";

type Participant = {
  id: number;
  source_id: number;
  nome: string;
  cognome: string;
  username: string;
  tipo_utente: "TMI" | "External";
  is_active: boolean;
  must_reset_password: boolean;
  has_password: boolean;
  livello_atteso: number | null;
  livello_affrontato: number;
  done: number[];
  scheduled: { level: number; lessonId: number }[];
  next: number | null;
  recommended: number | null;
};

export default function AdminPage() {
  const [participants, setParticipants] = React.useState<Participant[] | null>(null);
  const [importResult, setImportResult] = React.useState<any>(null);
  const [resetResult, setResetResult] = React.useState<{ name: string; password: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<"people" | "lessons" | "guide">("people");
  const [historyFor, setHistoryFor] = React.useState<number | null>(null);
  const [filter, setFilter] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/admin/participants");
    if (res.ok) {
      const data = await res.json();
      setParticipants(data.participants);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/participants/import", { method: "POST", body: formData });
      const data = await res.json();
      setImportResult(data);
      await load();
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReset(p: Participant) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: p.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetResult({ name: `${p.nome} ${p.cognome}`, password: data.temporaryPassword });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  const visible = (participants ?? []).filter((p) =>
    `${p.nome} ${p.cognome} ${p.username}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <>
      <AppHeader
        title="Pannello amministrativo · AI Lab VDI Booking"
        subtitle="Partecipanti, password e assegnazione lezioni"
      />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <nav className="flex gap-1 border-b border-border">
        {([
          ["people", "Partecipanti"],
          ["lessons", "Lezioni"],
          ["guide", "Guida"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "lessons" && <LessonsAdmin participants={participants ?? []} onChanged={load} />}

      {tab === "guide" && <AdminWiki />}

      {historyFor !== null && (
        <HistoryDialog participantId={historyFor} onClose={() => setHistoryFor(null)} onChanged={load} />
      )}

      {tab === "people" && (
        <>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Sincronizza partecipanti
          </CardTitle>
          <CardDescription>
            Genera il CSV dal report Excel con{" "}
            <code>python scripts/extract_participants.py AI_LAB_Report_Manageriale_*.xlsx</code> (colonne: Id, Nome,
            Cognome, Tipo Utente, Livello Atteso, Livello Svolto) e caricalo qui. Chi è presente nel file ha accesso
            all&apos;app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            disabled={busy}
            onChange={handleUpload}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-accent-foreground"
          />
          {importResult && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p>
                Righe elaborate: <strong>{importResult.totalRows}</strong> · Aggiornati:{" "}
                <strong>{importResult.updatedCount}</strong> · Nuovi:{" "}
                <strong>{importResult.created?.length ?? 0}</strong>
              </p>
              {importResult.detected && (
                <div className="mt-2 rounded-md border border-border bg-card p-2 text-xs">
                  <p className="font-medium">Colonne lette dal file</p>
                  <p>
                    Livello atteso:{" "}
                    {importResult.detected.columns.atteso ? (
                      <>
                        <strong>&quot;{importResult.detected.columns.atteso}&quot;</strong> ({importResult.detected.filled.atteso}{" "}
                        valori su {importResult.totalRows})
                      </>
                    ) : (
                      <strong className="text-accent">non trovata</strong>
                    )}
                  </p>
                  <p>
                    Livello svolto:{" "}
                    {importResult.detected.columns.affrontato ? (
                      <>
                        <strong>&quot;{importResult.detected.columns.affrontato}&quot;</strong> (
                        {importResult.detected.filled.affrontato} valori su {importResult.totalRows})
                      </>
                    ) : (
                      <strong className="text-accent">non trovata</strong>
                    )}
                  </p>
                  {(!importResult.detected.columns.atteso || !importResult.detected.columns.affrontato) && (
                    <p className="mt-1 text-muted-foreground">
                      Intestazioni presenti nel file: {importResult.detected.headers.join(" | ")}. Usa lo script
                      scripts/extract_participants.py per generare il CSV nel formato corretto.
                    </p>
                  )}
                </div>
              )}
              {importResult.error && <p className="mt-2 text-accent">{importResult.error}</p>}
              {importResult.created?.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  <p className="font-medium">Credenziali per i nuovi partecipanti (comunicale manualmente):</p>
                  {importResult.created.map((c: any) => (
                    <p key={c.username} className="font-mono text-xs">
                      {c.nome} {c.cognome} → utente: <strong>{c.username}</strong> · password temporanea:{" "}
                      <strong>{c.temporaryPassword}</strong>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {resetResult && (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
          Nuova password temporanea per <strong>{resetResult.name}</strong>:{" "}
          <span className="font-mono font-semibold">{resetResult.password}</span> — comunicala
          manualmente, non verrà mostrata di nuovo.
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Partecipanti</CardTitle>
            <CardDescription>Elenco sincronizzato dall&apos;ultimo import.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCcw className="h-4 w-4" /> Aggiorna
          </Button>
        </CardHeader>
        <CardContent>
          {!participants ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : (
            <div className="overflow-x-auto">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Cerca per nome, cognome o utente…"
                className="mb-3 h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
              />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Cognome</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Livello atteso</th>
                    <th className="py-2 pr-3">Livello svolto</th>
                    <th className="py-2 pr-3">Utente</th>
                    <th className="py-2 pr-3">Stato</th>
                    <th className="py-2 pr-3">Password</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const svolto = p.done.length ? Math.max(...p.done) : 0;
                    return (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="py-2 pr-3">{p.nome}</td>
                        <td className="py-2 pr-3 font-medium">{p.cognome}</td>
                        <td className="py-2 pr-3">{p.tipo_utente}</td>
                        <td className="py-2 pr-3">{p.livello_atteso ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <div>{svolto || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.next === null && p.livello_atteso !== null
                              ? "obiettivo raggiunto"
                              : `prossimo ${p.next ?? "—"}${p.recommended !== p.next ? ` · consigliato ${p.recommended ?? "—"}` : ""}`}
                          </div>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{p.username}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {!p.is_active && <Badge variant="muted">Non più nel file</Badge>}
                            {p.is_active && <Badge variant="success">Attivo</Badge>}
                            {p.must_reset_password && <Badge variant="muted">Da reimpostare</Badge>}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <PasswordCell participantId={p.id} available={p.has_password} />
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => handleReset(p)}>
                              <KeyRound className="h-3.5 w-3.5" /> Reset password
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setHistoryFor(p.id)}>
                              Storico
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
      </main>
    </>
  );
}
