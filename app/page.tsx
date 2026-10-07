"use client";

import * as React from "react";
import { LogOut, Sun, Moon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/booking/login-form";
import { ChangePasswordForm } from "@/components/booking/change-password-form";
import { LoginWiki } from "@/components/wiki/login-wiki";
import { UserWiki } from "@/components/wiki/user-wiki";
import { VdiCalendar } from "@/components/booking/vdi-calendar";
import { LessonsPanel, NextLessonBanner, type MyLessons } from "@/components/booking/lessons-panel";
import { cn } from "@/lib/utils";

type Me = { authenticated: boolean; nome?: string; cognome?: string };

export default function BookingPage() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [mustReset, setMustReset] = React.useState(false);
  const [tab, setTab] = React.useState<"vdi" | "lessons" | "guide">("vdi");
  const [lessons, setLessons] = React.useState<MyLessons | null>(null);
  const { theme, setTheme } = useTheme();

  const refreshMe = React.useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) {
      const data = await res.json();
      setMe(data);
    } else {
      setMe({ authenticated: false });
    }
  }, []);

  React.useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const authenticated = me?.authenticated === true;
  React.useEffect(() => {
    if (!authenticated) return;
    fetch("/api/lessons")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLessons(d))
      .catch(() => {});
  }, [authenticated]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ authenticated: false });
  }

  if (me === null) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Caricamento...</div>;
  }

  if (!me.authenticated) {
    return (
      <>
        <AppHeader title="Prenotazione VDI · AI Lab" />
        <main className="flex min-h-[calc(100vh-4.5rem)] flex-col items-center justify-center gap-6 p-6">
        <LoginForm
          onSuccess={(mustResetPassword) => {
            setMustReset(mustResetPassword);
            refreshMe();
          }}
        />
        <LoginWiki />
        </main>
      </>
    );
  }

  if (mustReset) {
    return (
      <>
        <AppHeader title="Prenotazione VDI · AI Lab" />
        <main className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center p-6">
          <ChangePasswordForm onDone={() => setMustReset(false)} />
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Prenotazione VDI · AI Lab" subtitle={`Ciao ${me.nome} ${me.cognome}`}>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Cambia tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-white/30 text-white hover:bg-white/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" /> Esci
        </Button>
      </AppHeader>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <NextLessonBanner lessons={lessons} onOpen={() => setTab("lessons")} />

      <nav className="flex gap-1 border-b border-border">
        {([
          ["vdi", "Prenota VDI"],
          ["lessons", "Le mie lezioni"],
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

      <section>
        {tab === "vdi" && <VdiCalendar />}
        {tab === "lessons" && <LessonsPanel lessons={lessons} />}
        {tab === "guide" && <UserWiki />}
      </section>
      </main>
    </>
  );
}
