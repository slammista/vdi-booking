"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ onSuccess }: { onSuccess: (mustResetPassword: boolean) => void }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Accesso non riuscito.");
        return;
      }
      onSuccess(Boolean(data.mustResetPassword));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-sm"
    >
      <Card>
        <CardHeader>
          <CardTitle>AI Lab · Prenotazione VDI</CardTitle>
          <CardDescription>
            Accedi con il nome utente e la password personale ricevuti dall&apos;amministratore.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Nome utente</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="es. mario.rossi"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-1">
              <LogIn className="h-4 w-4" />
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Password dimenticata? Contatta l&apos;amministratore del gruppo AI Lab: potrà
              reimpostarla in pochi secondi dal pannello amministrativo.
            </p>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
