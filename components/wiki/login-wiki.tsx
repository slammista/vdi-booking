import { OWNERS } from "@/lib/config";
import { Bullets, Code, Note, Steps, WikiSection } from "./wiki";

/** Guida mostrata nella pagina di login: come ottenere l'accesso e primo accesso. */
export function LoginWiki() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Prima volta? Come si accede
      </h2>
      <WikiSection title="Come ottenere l'accesso" defaultOpen>
        <Steps>
          <li>
            Chiedi la <strong>prima password</strong> agli owner dell&apos;app:
            <Bullets>
              {OWNERS.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </Bullets>
          </li>
          <li>
            Il <strong>nome utente</strong> è <Code>nome.cognome</Code> in minuscolo, senza accenti né spazi (es.{" "}
            <Code>mario.rossi</Code>). In caso di omonimia viene aggiunto un numero (es. <Code>mario.rossi2</Code>):
            chiedilo agli owner.
          </li>
          <li>
            Accedi con la password ricevuta: al <strong>primo accesso</strong> ti verrà chiesto di scegliere una nuova
            password personale (almeno 8 caratteri).
          </li>
        </Steps>
      </WikiSection>
      <WikiSection title="Conserva la tua password">
        <p>
          Dopo averla scelta, <strong>salvala in un posto sicuro</strong> (ad esempio un password manager).
        </p>
        <Note>
          Se la perdi, contatta uno degli owner ({OWNERS.join(", ")}): potranno ripristinarla e riceverai una nuova
          password temporanea da cambiare al primo accesso.
        </Note>
      </WikiSection>
      <WikiSection title="Non riesco ad accedere">
        <Bullets>
          <li>Controlla di aver scritto il nome utente tutto in minuscolo e nel formato nome.cognome.</li>
          <li>Se il problema persiste, scrivi a uno degli owner indicando il tuo nome utente.</li>
        </Bullets>
      </WikiSection>
    </div>
  );
}
