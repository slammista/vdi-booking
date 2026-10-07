"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { CalendarToolbar } from "@/components/calendar/toolbar";
import { MonthView, WeekView, YearView, type CalEvent, type YearTone } from "@/components/calendar/views";
import { isBookableDay } from "@/lib/holidays";
import { BOOKING_HORIZON_END, DAY_END_HOUR, DAY_START_HOUR, romeDateString } from "@/lib/slots";
import {
  addDays,
  clampStr,
  fmtMinutes,
  periodRange,
  romeMinutes,
  romeTime,
  todayRome,
  type CalView,
} from "@/lib/calendar";

export type AdminParticipant = {
  id: number;
  nome: string;
  cognome: string;
  username: string;
  is_active: boolean;
};

type Lesson = {
  id: number;
  title: string;
  notes: string | null;
  start: string;
  end: string;
  participants: { id: number; nome: string; cognome: string }[];
};

type Draft = {
  id: number | null;
  title: string;
  notes: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  participantIds: number[];
};

const START_TIMES = Array.from({ length: (DAY_END_HOUR - DAY_START_HOUR) * 4 }, (_, i) =>
  fmtMinutes(DAY_START_HOUR * 60 + i * 15)
);

const fmtDuration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`);

export function LessonsAdmin({ participants }: { participants: AdminParticipant[] }) {
  const today = todayRome();
  const [view, setView] = React.useState<CalView>("week");
  const [anchor, setAnchor] = React.useState(today);
  const [lessons, setLessons] = React.useState<Lesson[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const range = React.useMemo(() => periodRange(view, anchor), [view, anchor]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/admin/lessons?from=${range.from}&to=${range.to}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Impossibile caricare le lezioni.");
        if (!cancelled) setLessons(data.lessons);
      })
      .catch((e) => !cancelled && setLoadError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadKey]);

  const byDay = React.useMemo(() => {
    const m = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const k = romeDateString(new Date(l.start));
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  }, [lessons]);

  const openEdit = (l: Lesson) => {
    const s = new Date(l.start);
    setDraft({
      id: l.id,
      title: l.title,
      notes: l.notes ?? "",
      date: romeDateString(s),
      startTime: romeTime(s),
      durationMinutes: Math.round((new Date(l.end).getTime() - s.getTime()) / 60000),
      participantIds: l.participants.map((p) => p.id),
    });
  };

  const openNew = (date: string, startTime = "09:00") =>
    setDraft({ id: null, title: "", notes: "", date, startTime, durationMinutes: 60, participantIds: [] });

  const firstBookable = () => {
    let d = clampStr(anchor, today, BOOKING_HORIZON_END);
    for (let i = 0; i < 10 && !isBookableDay(d); i++) d = addDays(d, 1);
    return d;
  };

  const events: CalEvent[] = lessons.map((l) => {
    const s = new Date(l.start);
    const e = new Date(l.end);
    return {
      id: `l${l.id}`,
      dateStr: romeDateString(s),
      startMin: romeMinutes(s),
      endMin: romeMinutes(e) || 24 * 60,
      title: l.title,
      subtitle: `${romeTime(s)} – ${romeTime(e)} · ${l.participants.length} partecip.`,
      tone: "lesson",
      onClick: () => openEdit(l),
    };
  });

  const goWeek = (d: string) => {
    setView("week");
    setAnchor(d);
  };

  return (
    <div className="flex flex-col gap-3">
      <CalendarToolbar
        view={view}
        anchor={anchor}
        today={today}
        minDate={today}
        maxDate={BOOKING_HORIZON_END}
        loading={loading}
        onChange={(v, a) => {
          setView(v);
          setAnchor(clampStr(a, today, BOOKING_HORIZON_END));
        }}
        right={
          <Button size="sm" onClick={() => openNew(firstBookable())}>
            <Plus className="h-4 w-4" /> Nuova lezione
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {view === "week" && (
        <WeekView
          anchor={anchor}
          today={today}
          minDate={today}
          maxDate={BOOKING_HORIZON_END}
          events={events}
          cellDisabled={() => false}
          onCellClick={(d, h) => openNew(d, `${String(h).padStart(2, "0")}:00`)}
        />
      )}

      {view === "month" && (
        <MonthView
          anchor={anchor}
          today={today}
          minDate={today}
          maxDate={BOOKING_HORIZON_END}
          onDayClick={goWeek}
          renderDay={(d) => {
            const ls = byDay.get(d) ?? [];
            return (
              <div className="flex flex-col gap-0.5 text-[11px] leading-tight">
                {ls.slice(0, 3).map((l) => (
                  <span key={l.id} className="truncate rounded bg-success/15 px-1 py-0.5">
                    {romeTime(new Date(l.start))} {l.title}
                  </span>
                ))}
                {ls.length > 3 && <span className="text-muted-foreground">+{ls.length - 3} altre</span>}
              </div>
            );
          }}
        />
      )}

      {view === "year" && (
        <YearView
          anchor={anchor}
          today={today}
          minDate={today}
          maxDate={BOOKING_HORIZON_END}
          onDayClick={goWeek}
          onMonthClick={(m) => {
            setView("month");
            setAnchor(clampStr(m, today, BOOKING_HORIZON_END));
          }}
          dayTone={(d): YearTone => ((byDay.get(d)?.length ?? 0) > 0 ? "lesson" : "none")}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Clicca su una fascia libera (o su &quot;Nuova lezione&quot;) per assegnare una lezione, su una lezione per
        modificarla o eliminarla. Orari consentiti: lun-ven {DAY_START_HOUR}:00-{DAY_END_HOUR}:00, festivi esclusi.
      </p>

      {draft && (
        <LessonDialog
          draft={draft}
          participants={participants}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function LessonDialog({
  draft: initial,
  participants,
  onClose,
  onSaved,
}: {
  draft: Draft;
  participants: AdminParticipant[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [filter, setFilter] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const startMin = Number(draft.startTime.slice(0, 2)) * 60 + Number(draft.startTime.slice(3));
  const maxDuration = DAY_END_HOUR * 60 - startMin;
  const durations = Array.from({ length: Math.floor(maxDuration / 15) }, (_, i) => (i + 1) * 15);
  const duration = Math.min(draft.durationMinutes, maxDuration);

  const active = participants.filter((p) => p.is_active);
  const shown = active.filter((p) =>
    `${p.nome} ${p.cognome} ${p.username}`.toLowerCase().includes(filter.trim().toLowerCase())
  );
  const selected = new Set(draft.participantIds);
  const toggle = (id: number) =>
    set("participantIds", selected.has(id) ? draft.participantIds.filter((x) => x !== id) : [...draft.participantIds, id]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(draft.id ? `/api/admin/lessons/${draft.id}` : "/api/admin/lessons", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          notes: draft.notes,
          date: draft.date,
          startTime: draft.startTime,
          durationMinutes: duration,
          participantIds: draft.participantIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Salvataggio non riuscito.");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lessons/${draft.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Eliminazione non riuscita.");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={draft.id ? "Modifica lezione" : "Nuova lezione"} onClose={() => !busy && onClose()} wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="l-title">Titolo</Label>
          <Input id="l-title" value={draft.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-date">Giorno</Label>
            <Input
              id="l-date"
              type="date"
              value={draft.date}
              max={BOOKING_HORIZON_END}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-start">Inizio</Label>
            <select
              id="l-start"
              value={draft.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {START_TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-dur">Durata</Label>
            <select
              id="l-dur"
              value={duration}
              onChange={(e) => set("durationMinutes", Number(e.target.value))}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {durations.map((m) => (
                <option key={m} value={m}>
                  {fmtDuration(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Fine lezione: {fmtMinutes(startMin + duration)} (max {DAY_END_HOUR}:00)
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="l-notes">Note (facoltative)</Label>
          <Input id="l-notes" value={draft.notes} maxLength={500} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Partecipanti ({draft.participantIds.length} selezionati)</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("participantIds", Array.from(new Set([...draft.participantIds, ...shown.map((p) => p.id)])))}
              >
                Seleziona mostrati
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => set("participantIds", [])}>
                Azzera
              </Button>
            </div>
          </div>
          <Input placeholder="Cerca per nome o utente…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-48 overflow-y-auto rounded-md border border-border">
            {shown.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nessun partecipante trovato.</p>
            ) : (
              shown.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span>
                    {p.cognome} {p.nome}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{p.username}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div>
            {draft.id &&
              (confirmDelete ? (
                <Button variant="destructive" size="sm" disabled={busy} onClick={remove}>
                  Conferma eliminazione
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Elimina
                </Button>
              ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Chiudi
            </Button>
            <Button onClick={save} disabled={busy || !draft.title.trim() || draft.participantIds.length === 0}>
              {draft.id ? "Salva modifiche" : "Crea lezione"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
