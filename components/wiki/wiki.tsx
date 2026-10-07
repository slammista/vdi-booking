import * as React from "react";
import { ChevronDown } from "lucide-react";

/** Sezione espandibile (nativa <details>, accessibile da tastiera e senza JS). */
export function WikiSection({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </details>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-1.5 pl-5">{children}</ol>;
}

export function Bullets({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border-l-4 border-accent bg-muted px-3 py-2 text-sm text-foreground">{children}</p>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>;
}
