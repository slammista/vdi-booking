import * as React from "react";
import { MonitorSmartphone } from "lucide-react";

/** Barra superiore nera con filetto rosso, usata da tutte le schermate. */
export function AppHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b-4 border-accent bg-[hsl(0_0%_7%)] text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <MonitorSmartphone className="h-6 w-6 shrink-0 text-accent" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-white/70">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
