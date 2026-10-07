"use client";

import * as React from "react";
import { CalendarClock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { longDate, romeTime } from "@/lib/calendar";
import { romeDateString } from "@/lib/slots";
import { cn } from "@/lib/utils";
import type { Progress } from "@/lib/levels";

export type MyLesson = {
  id: number;
  title: string;
  notes: string | null;
  level: number;
  attended: boolean;
  start: string;
  end: string;
  participants: number;
};
export type MyLessons = { next: MyLesson | null; upcoming: MyLesson[]; past: MyLesson[]; progress: Progress };

function when(l: MyLesson) {
  const s = new Date(l.start);
  return { day: longDate(romeDateString(s)), time: `${romeTime(s)} – ${romeTime(new Date(l.end))}` };
}

function relative(l: MyLesson): string {
  const days = Math.round(
    (Date.parse(romeDateString(new Date(l.start))) - Date.parse(romeDateString(new Date()))) / 86400000
  );
  if (days <= 0) return "oggi";
  if (days === 1) return "domani";
  return `tra ${days} giorni`;
}

export function NextLessonBanner({ lessons, onOpen }: { lessons: MyLessons | null; onOpen: () => void }) {
  if (!lessons) return null;
  const l = lessons.next;
  if (!l) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Nessuna lezione programmata al momento.
      </div>
    );
  }
  const w = when(l);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-left transition-colors hover:bg-success/15"
    >
      <CalendarClock className="h-6 w-6 shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prossima lezione · {relative(l)}</p>
        <p className="truncate font-semibold">
          {l.title} <span className="font-normal text-muted-foreground">· Livello {l.level}</span>
        </p>
        <p className="text-sm first-letter:uppercase">
          {w.day} · {w.time}
        </p>
      </div>
    </button>
  );
}

function LessonRow({ l, muted }: { l: MyLesson; muted?: boolean }) {
  const w = when(l);
  return (
    <li className={`flex flex-col gap-0.5 rounded-md border border-border px-3 py-2 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {l.title} <span className="font-normal text-muted-foreground">· Livello {l.level}</span>
        </span>
        {!l.attended && <Badge variant="destructive">Assente</Badge>}
        {l.participants > 1 && (
          <Badge variant="muted" className="gap-1">
            <Users className="h-3 w-3" /> {l.participants}
          </Badge>
        )}
      </div>
      <span className="text-sm first-letter:uppercase text-muted-foreground">
        {w.day} · {w.time}
      </span>
      {l.notes && <span className="text-sm">{l.notes}</span>}
    </li>
  );
}

const STEP_STYLE: Record<string, string> = {
  done: "border-foreground bg-foreground text-background",
  scheduled: "border-accent bg-accent/10 text-accent",
  next: "border-accent bg-accent text-accent-foreground",
  todo: "border-border bg-card text-muted-foreground",
};
const STEP_LABEL: Record<string, string> = {
  done: "Svolto",
  scheduled: "Programmato",
  next: "Prossimo step",
  todo: "Da fare",
};

function ProgressCard({ progress }: { progress: Progress }) {
  const { steps, next, atteso } = progress;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Il tuo percorso</CardTitle>
        <CardDescription>
          {atteso ? `Livello atteso: ${atteso}. ` : ""}
          {steps.length === 0
            ? "Il percorso non è ancora stato impostato: contatta gli amministratori."
            : next
              ? `Prossimo step: livello ${next}.`
              : "Hai completato tutti i livelli previsti."}
        </CardDescription>
      </CardHeader>
      {steps.length > 0 && (
        <CardContent>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {steps.map((st) => (
              <li key={st.level} className={cn("flex flex-col gap-0.5 rounded-md border px-3 py-2", STEP_STYLE[st.status])}>
                <span className="text-xs uppercase tracking-wide opacity-80">Livello {st.level}</span>
                <span className="text-sm font-semibold">{STEP_LABEL[st.status]}</span>
                {st.date && (
                  <span className="text-xs opacity-90">
                    {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Rome" }).format(new Date(st.date))}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

export function LessonsPanel({ lessons }: { lessons: MyLessons | null }) {
  if (!lessons) return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  return (
    <div className="flex flex-col gap-4">
      <ProgressCard progress={lessons.progress} />
      <Card>
        <CardHeader>
          <CardTitle>Prossime lezioni</CardTitle>
          <CardDescription>Assegnate dall&apos;amministratore. Giorno e orario non sono modificabili da qui.</CardDescription>
        </CardHeader>
        <CardContent>
          {lessons.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna lezione programmata.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lessons.upcoming.map((l) => (
                <LessonRow key={l.id} l={l} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {lessons.past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lezioni passate</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {lessons.past.map((l) => (
                <LessonRow key={l.id} l={l} muted />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
