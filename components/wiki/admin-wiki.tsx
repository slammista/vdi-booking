import { BOOKING_HORIZON_END } from "@/lib/slots";
import { MAX_LEVEL } from "@/lib/levels";
import { OWNERS } from "@/lib/config";
import { Bullets, Code, Note, Steps, WikiSection } from "./wiki";

/** Guida per gli amministratori. */
export function AdminWiki() {
  return (
    <div className="flex flex-col gap-3">
      <WikiSection title="Importare i partecipanti (CSV)" defaultOpen>
        <p>
          Esporta il foglio <Code>DB_Partecipanti</Code> in CSV (UTF-8; separatore <Code>,</Code> o <Code>;</Code>) e
          caricalo in <strong>Partecipanti → Sincronizza</strong>.
        </p>
        <Bullets>
          <li>
            Colonne obbligatorie: <Code>Id</Code>, <Code>Nome</Code>, <Code>Cognome</Code>, <Code>Tipo Utente</Code>{" "}
            (TMI / External).
          </li>
          <li>
            <Code>Idoneo Prenotazione VDI</Code>: <Code>Si</Code>/<Code>Sì</Code> abilita, qualsiasi altro valore no.
          </li>
          <li>
            Facoltative: <Code>Livello Atteso</Code> e <Code>Livello Affrontato</Code> (numeri 0–{MAX_LEVEL}). Se
            presenti e manca la colonna Idoneo, l&apos;idoneità è calcolata come{" "}
            <strong>max(atteso, affrontato) ≥ 2</strong>.
          </li>
        </Bullets>
        <Note>
          Se una colonna dei livelli è assente dal CSV, i valori già nel sistema non vengono toccati. Chi non è più nel
          file viene disattivato, non cancellato.
        </Note>
      </WikiSection>

      <WikiSection title="Password: consegna, visualizzazione, reset">
        <Bullets>
          <li>
            I nuovi partecipanti ricevono una <strong>password temporanea</strong>, mostrata al termine dell&apos;import:
            copiala e comunicala fuori dall&apos;app.
          </li>
          <li>
            Nella tabella Partecipanti, la colonna <strong>Password</strong> (prima di &quot;Reset password&quot;) mostra
            la password attuale su richiesta con <strong>Mostra</strong>. Dopo che l&apos;utente la cambia, qui compare
            quella scelta da lui.
          </li>
          <li>
            Per gli utenti già esistenti prima di questa funzione la password non è disponibile finché non viene
            reimpostata o cambiata dall&apos;utente.
          </li>
          <li>
            <strong>Reset password</strong>: genera una nuova temporanea e obbliga al cambio al prossimo accesso. È la
            procedura per chi contatta gli owner ({OWNERS.join(", ")}) dopo aver perso la password.
          </li>
        </Bullets>
        <Note>
          Le password consultabili sono salvate cifrate. Se cambi <Code>SESSION_SECRET</Code> su Vercel, tutti gli utenti
          continuano ad accedere ma le password salvate non sono più visibili fino al prossimo reset o cambio.
        </Note>
      </WikiSection>

      <WikiSection title="Livelli e storico dei partecipanti">
        <p>Per ogni partecipante il sistema calcola il percorso a livelli:</p>
        <Bullets>
          <li>
            <strong>Svolti</strong>: livelli da 1 a <em>Livello Affrontato</em> (dal file) più le lezioni concluse a cui
            ha partecipato.
          </li>
          <li>
            <strong>Prossimo</strong>: il primo livello, fino al livello atteso, non ancora svolto.{" "}
            <strong>Consigliato</strong>: come il prossimo, ma saltando i livelli già programmati.
          </li>
        </Bullets>
        <p>
          Esempio: atteso 3, svolto solo il livello 1 → il livello 1 risulta già svolto (oscurato) e il consigliato è{" "}
          <strong>2</strong>.
        </p>
        <p>
          Il pulsante <strong>Storico</strong> mostra le lezioni del partecipante e permette di segnarlo{" "}
          <strong>assente</strong>: un&apos;assenza non conta come livello svolto.
        </p>
      </WikiSection>

      <WikiSection title="Assegnare le lezioni">
        <Steps>
          <li>
            Apri <strong>Lezioni</strong>: clicca una fascia libera del calendario o &quot;Nuova lezione&quot;.
          </li>
          <li>
            Scegli <strong>titolo</strong>, <strong>giorno</strong>, <strong>inizio</strong> (passi da 15 minuti) e{" "}
            <strong>durata</strong>. Solo lun–ven 09:00–18:00, festivi esclusi, fino al{" "}
            {BOOKING_HORIZON_END.split("-").reverse().join("/")}.
          </li>
          <li>
            Seleziona i <strong>partecipanti</strong>: il <strong>livello</strong> si imposta in automatico sul più
            consigliato per i selezionati (per una persona sola è esattamente il suo prossimo livello). Puoi cambiarlo a
            mano.
          </li>
          <li>
            Chi ha già svolto il livello scelto compare <strong>oscurato e non selezionabile</strong>. Un avviso segnala
            chi è oltre il livello atteso o ha già quel livello programmato.
          </li>
        </Steps>
        <Bullets>
          <li>Una persona non può avere due lezioni sovrapposte: il salvataggio viene rifiutato indicando i nomi.</li>
          <li>Clicca una lezione esistente per modificarla o eliminarla.</li>
          <li>
            Le lezioni non occupano la VDI: sono indipendenti dalle prenotazioni. Una lezione conclusa vale come
            livello svolto per chi vi ha partecipato.
          </li>
        </Bullets>
      </WikiSection>

      <WikiSection title="Accesso admin e riepilogo operativo">
        <Bullets>
          <li>
            L&apos;accesso a questa pagina usa una password condivisa (<Code>ADMIN_PASSWORD</Code> su Vercel), distinta da
            quelle dei partecipanti.
          </li>
          <li>Per cambiare l&apos;orizzonte di date o il numero di livelli serve una modifica al codice.</li>
          <li>Per problemi tecnici contatta uno degli owner: {OWNERS.join(", ")}.</li>
        </Bullets>
      </WikiSection>
    </div>
  );
}
