"use client";

import * as React from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { longDate, romeTime } from "@/lib/calendar";
import { romeDateString } from "@/lib/slots";
import type { Progress } from "@/lib/levels";

/** Password attuale su richiesta (mai caricata finche' non si preme "Mostra"). */
export function PasswordCell({ participantId, available }: { participantId: number; available: boolean }) {
  const [value, setValue] = React.useState<string | null | undefined>(undefined); // undefined = nascosta
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // se la password cambia (reset) la visualizzazione si azzera
  React.useEffect(() => setValue(undefined), [participantId, available]);

  if (!available) {
    return <span className="text-xs text-muted-foreground">Non disponibile (serve reset)</span>;
  }

  async function show() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/participants/${participantId}/password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setValue(res.ok ? (data.password ?? null) : null);
    } finally {
      setBusy(false);
    }
  }

  if (value === undefined) {
    return (
      <Button variant="outline" size="sm" disabled={busy} onClick={show}>
        <Eye className="h-3.5 w-3.5" /> Mostra
      </Button>
    );
  }
  if (value === null) {
    return <span className="text-xs text-muted-foreground">Non leggibile (serve reset)</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-xs font-semibold">{value}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Copia password"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      {copied && <span className="text-xs text-muted-foreground">Copiata</span>}
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Nascondi password" onClick={() => setValue(undefined)}>
        <EyeOff className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

type HistoryData = {
  participant: { id: number; nome: string; cognome: string; livello_atteso: number | null; livello_affrontato: number };
  lessons: { lesson_id: number; title: string; level: number; attended: boolean; start: string; end: string }[];
  progress: Progress;
};

const STATUS_LABEL = { done: "Svolto", scheduled: "Programmato", next: "Prossimo", todo: "Da fare" } as const;

/** Storico lezioni e progressione di un partecipante, con segnalazione assenze. */
export function HistoryDialog({
  participantId,
  onClose,
  onChanged,
}: {
  participantId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = React.useState<HistoryData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/admin/participants/${participantId}/history`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error ?? "Impossibile caricare lo storico.");
    setData(json);
  }, [participantId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function setAttended(lessonId: number, attended: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/participants/${participantId}/history`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, attended }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "Aggiornamento non riuscito.");
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  return (
    <Modal
      title={data ? `Storico · ${data.participant.nome} ${data.participant.cognome}` : "Storico"}
      onClose={onClose}
      wide
    >
      {!data ? (
        <p className="text-sm text-muted-foreground">{error ?? "Caricamento…"}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Livello atteso: <strong className="text-foreground">{data.progress.atteso ?? "—"}</strong> · Livello
            affrontato (dal file): <strong className="text-foreground">{data.progress.affrontato}</strong> · Prossimo:{" "}
            <strong className="text-foreground">{data.progress.next ?? "completato"}</strong>
          </p>

          {data.progress.steps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.progress.steps.map((s) => (
                <Badge key={s.level} variant={s.status === "done" ? "default" : s.status === "todo" ? "muted" : "success"}>
                  L{s.level} · {STATUS_LABEL[s.status]}
                </Badge>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Lezioni assegnate</h3>
            {data.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna lezione assegnata nel sistema.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {data.lessons.map((l) => {
                  const past = new Date(l.end).getTime() <= now;
                  return (
                    <li key={l.lesson_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        <strong>L{l.level}</strong> · {l.title}
                        <span className="block text-xs text-muted-foreground first-letter:uppercase">
                          {longDate(romeDateString(new Date(l.start)))} · {romeTime(new Date(l.start))}–
                          {romeTime(new Date(l.end))} · {past ? (l.attended ? "svolta" : "assente") : "programmata"}
                        </span>
                      </span>
                      {past && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setAttended(l.lesson_id, !l.attended)}>
                          {l.attended ? "Segna assente" : "Segna presente"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
