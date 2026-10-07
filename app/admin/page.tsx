"use client";

import * as React from "react";
import { Upload, KeyRound, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonsAdmin } from "@/components/admin/lessons-admin";
import { cn } from "@/lib/utils";

type Participant = {
  id: number;
  source_id: number;
  nome: string;
  cognome: string;
  username: string;
  tipo_utente: "TMI" | "External";
  idoneo_prenotazione: boolean;
  is_active: boolean;
  must_reset_password: boolean;
};

export default function AdminPage() {
  const [participants, setParticipants] = React.useState<Participant[] | null>(null);
  const [importResult, setImportResult] = React.useState<any>(null);
  const [resetResult, setResetResult] = React.useState<{ name: string; password: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<"people" | "lessons">("people");
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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Pannello amministrativo · AI Lab VDI Booking</h1>
        <p className="text-sm text-muted-foreground">
          Sincronizza i partecipanti dal report Excel, gestisci le password e assegna le lezioni.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {([
          ["people", "Partecipanti"],
          ["lessons", "Lezioni"],
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

      {tab === "lessons" && <LessonsAdmin participants={participants ?? []} />}

      {tab === "people" && (
        <>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Sincronizza partecipanti
          </CardTitle>
          <CardDescription>
            Carica il CSV esportato dal foglio <code>DB_Partecipanti</code> del report
            (AI_LAB_Report_Manageriale_*.xlsx, generato automaticamente dall&apos;agente).
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Utente</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Stato</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        {p.nome} {p.cognome}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.username}</td>
                      <td className="py-2 pr-3">{p.tipo_utente}</td>
                      <td className="py-2 pr-3 flex flex-wrap gap-1">
                        {!p.is_active && <Badge variant="muted">Non più attivo</Badge>}
                        {p.is_active && !p.idoneo_prenotazione && <Badge variant="destructive">Non idoneo</Badge>}
                        {p.is_active && p.idoneo_prenotazione && <Badge variant="success">Attivo</Badge>}
                        {p.must_reset_password && <Badge variant="muted">Da reimpostare</Badge>}
                      </td>
                      <td className="py-2 pr-3">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => handleReset(p)}>
                          <KeyRound className="h-3.5 w-3.5" /> Reset password
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </main>
  );
}
