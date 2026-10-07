-- ============================================================================
-- AI LAB VDI Booking — schema Postgres (Vercel Postgres / Neon / Supabase)
-- Nessun dato aziendale: partecipanti identificati solo da nome, cognome,
-- username generato (non email) e una password personale (hashata).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- su Supabase: valuta 'WITH SCHEMA extensions'

-- ---------------------------------------------------------------------------
-- Partecipanti (sincronizzati dal foglio DB_Partecipanti del report Excel,
-- tramite upload manuale del CSV dalla pagina /admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
    id                  SERIAL PRIMARY KEY,
    source_id           INTEGER NOT NULL,              -- ID dal foglio Persone
    nome                TEXT NOT NULL,
    cognome             TEXT NOT NULL,
    username            TEXT NOT NULL UNIQUE,           -- es. mario.rossi (generato, univoco)
    tipo_utente         TEXT NOT NULL CHECK (tipo_utente IN ('TMI', 'External')),
    idoneo_prenotazione BOOLEAN NOT NULL DEFAULT TRUE,
    password_hash       TEXT NOT NULL,                  -- bcrypt, MAI testo in chiaro
    must_reset_password BOOLEAN NOT NULL DEFAULT TRUE,  -- forza il cambio al primo accesso
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,  -- false se rimosso in un sync successivo
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_source_id ON participants(source_id);

-- ---------------------------------------------------------------------------
-- Risorse VDI (oggi una sola, ma predisposto per espansione)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vdi_resources (
    id        SERIAL PRIMARY KEY,
    code      TEXT NOT NULL UNIQUE,   -- es. 'VDI-AI-01'
    label     TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- Prenotazioni
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    id             SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL REFERENCES participants(id),
    resource_id    INTEGER NOT NULL REFERENCES vdi_resources(id),
    slot           TSTZRANGE NOT NULL,     -- intervallo [slot_start, slot_end)
    stato          TEXT NOT NULL DEFAULT 'Confermata'
                     CHECK (stato IN ('Confermata', 'Annullata')),
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Vincolo chiave: impedisce DUE prenotazioni "Confermata" che si
    -- sovrappongono sulla STESSA risorsa. Garantisce l'esclusivita' dello
    -- slot (nessuna condivisione), applicata dal database stesso.
    EXCLUDE USING gist (
        resource_id WITH =,
        slot WITH &&
    ) WHERE (stato = 'Confermata')
);

CREATE INDEX IF NOT EXISTS idx_bookings_participant ON bookings(participant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings USING gist (slot);

-- ---------------------------------------------------------------------------
-- Sicurezza: l'app accede con la connection string Postgres (ruolo che
-- bypassa l'RLS). Abilitare l'RLS senza policy chiude invece l'accesso dalla
-- Data API pubblica di Supabase (anon key).
-- ---------------------------------------------------------------------------
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vdi_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Dati iniziali
-- ---------------------------------------------------------------------------
INSERT INTO vdi_resources (code, label) VALUES ('VDI-AI-01', 'VDI AI Lab - Macchina 1')
ON CONFLICT (code) DO NOTHING;
