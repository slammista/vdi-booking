"use client";

import * as React from "react";
import { MonitorSmartphone, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/booking/login-form";
import { ChangePasswordForm } from "@/components/booking/change-password-form";
import { WeekNavigator, type DayOption } from "@/components/booking/week-navigator";
import { SlotGrid } from "@/components/booking/slot-grid";

type Me = { authenticated: boolean; nome?: string; cognome?: string };

function buildNextDays(count: number): DayOption[] {
  // NB: per semplicità lato client si escludono qui solo i weekend; le
  // festività italiane sono comunque applicate server-side (vedi
  // lib/holidays.ts) sia nel calcolo degli slot sia nella validazione della
  // prenotazione, quindi un giorno festivo infrasettimanale mostrerà
  // semplicemente "nessuno slot disponibile" se selezionato.
  const days: DayOption[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push({
        // data di calendario locale (toISOString() la sposterebbe in UTC)
        iso: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
        label: cursor.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
        weekday: cursor.toLocaleDateString("it-IT", { weekday: "short" }),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function BookingPage() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [mustReset, setMustReset] = React.useState(false);
  const [days] = React.useState<DayOption[]>(() => buildNextDays(10));
  const [selectedDay, setSelectedDay] = React.useState(days[0]?.iso ?? "");
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ authenticated: false });
  }

  if (me === null) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Caricamento...</div>;
  }

  if (!me.authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <LoginForm
          onSuccess={(mustResetPassword) => {
            setMustReset(mustResetPassword);
            refreshMe();
          }}
        />
      </main>
    );
  }

  if (mustReset) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <ChangePasswordForm onDone={() => setMustReset(false)} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">Prenotazione VDI · AI Lab</h1>
            <p className="text-sm text-muted-foreground">
              Ciao {me.nome} {me.cognome}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Cambia tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Esci
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <WeekNavigator days={days} selected={selectedDay} onSelect={setSelectedDay} />
        {selectedDay && <SlotGrid date={selectedDay} />}
      </section>
    </main>
  );
}
