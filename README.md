# AI Lab · Prenotazione VDI

App di prenotazione slot sulla VDI del gruppo AI Lab. **Nessun dato aziendale**:
i partecipanti sono identificati solo da nome, cognome e una password
personale; nessuna email, nessun account Microsoft, nessuna chiamata verso
SharePoint/Graph.

Questo è uno **scaffold funzionante e completo**, pensato per essere aperto in
un editor (o in Claude Code) e rifinito/esteso prima del go-live. Non è stato
possibile eseguire `npm install` / `npm run build` in questo ambiente (nessun
accesso alla rete), quindi segui i passi di verifica qui sotto al primo avvio
in locale.

## Stack

- **Next.js 15** (App Router) + React 18 + TypeScript
- **Tailwind CSS** con tema personalizzato "Graphite + Ember" (non il grigio
  di default) — vedi `app/globals.css` e `tailwind.config.ts`
- **Font Geist** (Sans + Mono), lo stesso font di default di Vercel — non Inter
- **lucide-react** per le icone, **framer-motion** per micro-animazioni mirate
- **PostgreSQL** (via `pg`, nessun ORM) con un vincolo `EXCLUDE` nativo che
  garantisce l'esclusività degli slot
- **jose** per sessioni JWT in cookie httpOnly (compatibile con l'Edge
  Runtime, usato in `middleware.ts`)
- **bcryptjs** per l'hashing delle password (puro JS, nessuna dipendenza nativa)

## Primo avvio in locale

```bash
npm install
cp .env.example .env.local
# modifica .env.local con i tuoi valori (DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD)

npm run db:init     # applica schema.sql al database
npm run dev         # http://localhost:3000
```

Apri `http://localhost:3000/admin/login`, accedi con `ADMIN_PASSWORD`, e
carica il CSV esportato dal foglio `DB_Partecipanti` del report generato
dall'agente della Fase 1 (`AI_LAB_Report_Manageriale_*.xlsx`). Il pannello
mostrerà username e password temporanea generati per ogni nuovo partecipante:
comunicali manualmente (di persona, in chat) — non c'è alcun invio email.

## Deploy su Vercel (fuori dal perimetro aziendale)

1. Crea un account **GitHub personale** (email non aziendale) e pusha questa
   repo.
2. Crea un account **Vercel personale** (login "Continue with GitHub").
3. Crea un database Postgres con un account personale: **Vercel Postgres**,
   **Neon** o **Supabase** funzionano tutti con questo schema.
4. In Vercel, collega la repo e imposta le **Environment Variables** con
   gli stessi nomi di `.env.example`.
5. Esegui `npm run db:init` puntando a `DATABASE_URL` di produzione (puoi
   farlo in locale, basta avere temporaneamente quella variabile nel tuo
   `.env.local`).
6. Deploy. Se possibile, esegui push/deploy da una rete non aziendale.

## Struttura del progetto

```
app/
  page.tsx                      Pagina di prenotazione (login → cambio password → calendario)
  admin/page.tsx                Pannello admin (import CSV, reset password)
  admin/login/page.tsx          Login amministratore
  api/auth/...                  Login, logout, cambio password utente
  api/bookings/...              Lista slot/disponibilità, creazione, annullamento
  api/admin/...                 Login admin, elenco partecipanti, import CSV, reset password
lib/
  db.ts                         Pool Postgres condiviso
  auth.ts                       Hash password, sessioni JWT, generazione username
  holidays.ts                   Festività italiane calcolate dinamicamente (incl. Pasqua)
  slots.ts                      Generazione slot 09:00-18:00, lun-ven
  csv.ts                        Parser del CSV DB_Partecipanti
components/
  ui/                           Button, Card, Input, Label, Badge (stile personalizzato)
  booking/                      Login form, cambio password, navigatore settimana, griglia slot
middleware.ts                   Protezione delle rotte /admin
schema.sql                      Schema Postgres completo (incluso il vincolo di esclusività)
```

## Regole di business implementate

- **Slot**: 09:00–18:00, passo di 60 minuti, lunedì-venerdì.
- **Festività italiane**: calcolate dinamicamente in `lib/holidays.ts`
  (incluso l'algoritmo di Meeus/Jones/Butcher per la Pasqua), nessun
  aggiornamento manuale necessario negli anni futuri. La stessa logica è
  usata nello script Python dell'agente (Fase 1), per coerenza.
- **Esclusività dello slot**: garantita dal vincolo `EXCLUDE` in `schema.sql`,
  non solo dalla UI — anche richieste simultanee non possono creare doppie
  prenotazioni sullo stesso orario/risorsa.
- **Autenticazione**: username generato da nome+cognome, password hashata
  (bcrypt), nessuna email. Reset password gestito dal pannello admin, che
  genera una nuova password temporanea mostrata una sola volta.

## Prossimi passi consigliati prima del go-live

- [ ] Verificare in locale che `npm install && npm run build` completino senza
      errori (non è stato possibile farlo in questo ambiente di generazione).
- [ ] Rivedere/estendere la UI con componenti shadcn/ui ufficiali se desideri
      un set più ampio (dialog, toast, calendar) — gli attuali componenti in
      `components/ui/` sono volutamente minimali ma nello stesso stile.
- [ ] Aggiungere un meccanismo di rate-limiting sul login (es. blocco dopo N
      tentativi falliti) prima dell'esposizione pubblica.
- [ ] Decidere se servono più risorse VDI oltre a `VDI-AI-01` (lo schema è
      già pronto per espandersi: basta aggiungere righe a `vdi_resources`).
