import { BOOKING_HORIZON_END } from "@/lib/slots";
import { MAX_LEVEL } from "@/lib/levels";
import { OWNERS } from "@/lib/config";
import { Bullets, Note, Steps, WikiSection } from "./wiki";

/** Guida per gli utenti autenticati. */
export function UserWiki() {
  return (
    <div className="flex flex-col gap-3">
      <WikiSection title="Prenotare la VDI" defaultOpen>
        <Steps>
          <li>
            Apri la scheda <strong>Prenota VDI</strong>. Nel calendario passa tra <strong>Settimana</strong>,{" "}
            <strong>Mese</strong> e <strong>Anno</strong>; con le frecce ti sposti nel tempo, con <strong>Oggi</strong>{" "}
            torni alla data corrente.
          </li>
          <li>
            Clicca una <strong>cella libera</strong> (o &quot;Nuova prenotazione&quot;), scegli giorno e slot e premi{" "}
            <strong>Prenota</strong>.
          </li>
          <li>
            Nelle viste Mese e Anno un clic su un giorno apre la settimana corrispondente: lì scegli lo slot.
          </li>
        </Steps>
        <Bullets>
          <li>Ogni prenotazione dura <strong>1 ora</strong>, con fasce fisse dalle 09:00 alle 18:00.</li>
          <li>Si prenota da lunedì a venerdì, festività escluse, fino al {BOOKING_HORIZON_END.split("-").reverse().join("/")}.</li>
          <li>Uno slot può essere assegnato a <strong>una sola persona</strong>: gli altri lo vedono come &quot;Occupato&quot;.</li>
          <li>Non si possono prenotare slot già iniziati o passati.</li>
        </Bullets>
      </WikiSection>

      <WikiSection title="Modificare o annullare una prenotazione">
        <Steps>
          <li>
            Clicca la tua prenotazione nel calendario (in rosso) oppure <strong>&quot;Modifica o annulla&quot;</strong>{" "}
            nell&apos;elenco &quot;Le tue prenotazioni&quot; in fondo alla pagina.
          </li>
          <li>
            Per <strong>spostarla</strong> cambia giorno e/o slot e premi <strong>Salva modifiche</strong>. Gli slot
            occupati sono disabilitati.
          </li>
          <li>
            Per <strong>annullarla</strong> premi &quot;Annulla prenotazione&quot; e conferma. Lo slot torna libero per
            gli altri.
          </li>
        </Steps>
        <Note>Una prenotazione già iniziata non si può più spostare, solo annullare.</Note>
      </WikiSection>

      <WikiSection title="Le lezioni e i livelli">
        <p>
          Le lezioni sono assegnate dagli <strong>amministratori</strong>: non le prenoti tu. Nella scheda{" "}
          <strong>Le mie lezioni</strong> trovi:
        </p>
        <Bullets>
          <li>
            la <strong>prossima lezione</strong> (giorno, orario, livello), evidenziata anche in alto in ogni pagina;
          </li>
          <li>
            il tuo <strong>percorso a livelli</strong> (1–{MAX_LEVEL}): per ogni livello se è <em>svolto</em>,{" "}
            <em>programmato</em>, il <em>prossimo step</em> o ancora da fare;
          </li>
          <li>lo storico delle lezioni a cui hai partecipato.</li>
        </Bullets>
        <Note>
          Il livello a cui puntare (&quot;atteso&quot;) e i livelli già svolti derivano dai dati del gruppo. Gli admin
          assegnano sempre il primo livello non ancora svolto: un livello già completato non viene riproposto.
        </Note>
      </WikiSection>

      <WikiSection title="Password e accesso">
        <Bullets>
          <li>Conserva la password che hai scelto al primo accesso (meglio in un password manager).</li>
          <li>
            Se la perdi, contatta gli owner ({OWNERS.join(", ")}): la reimposteranno e ti daranno una nuova password
            temporanea.
          </li>
          <li>Esci sempre con &quot;Esci&quot; se usi un computer condiviso.</li>
        </Bullets>
      </WikiSection>

      <WikiSection title="Domande frequenti">
        <Bullets>
          <li>
            <strong>Non vedo slot liberi:</strong> controlla di non essere in un weekend o in un giorno festivo, oppure
            scegli un altro giorno: la giornata potrebbe essere completa.
          </li>
          <li>
            <strong>Errore &quot;slot appena prenotato&quot;:</strong> un altro utente è stato più veloce. Il calendario
            si aggiorna: scegli un altro slot.
          </li>
          <li>
            <strong>Non vedo la mia lezione:</strong> se te l&apos;aspettavi, scrivi a uno degli owner.
          </li>
        </Bullets>
      </WikiSection>
    </div>
  );
}
