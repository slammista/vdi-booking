"use client";

import * as React from "react";
import { CalendarClock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { longDate, romeTime } from "@/lib/calendar";
import { romeDateString } from "@/lib/slots";

export type MyLesson = { id: number; title: string; notes: string | null; start: string; end: string; participants: number };
export type MyLessons = { next: MyLesson | null; upcoming: MyLesson[]; past: MyLesson[] };

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
        <p className="truncate font-semibold">{l.title}</p>
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
        <span className="font-medium">{l.title}</span>
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

export function LessonsPanel({ lessons }: { lessons: MyLessons | null }) {
  if (!lessons) return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  return (
    <div className="flex flex-col gap-4">
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
