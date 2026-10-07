import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "muted" | "destructive";

const variantClasses: Record<Variant, string> = {
  default: "bg-accent/15 text-accent border-accent/30",
  success: "bg-success/15 text-success border-success/30",
  muted: "bg-muted text-muted-foreground border-border",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
