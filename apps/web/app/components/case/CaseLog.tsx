import { Section } from '~/components/ui';

interface Props {
  /** Date de réception (« aujourd'hui, 09:12 ») : l'heure ouvre le journal. */
  received: string;
  log: { at: string; event: string }[];
}

/** Journal du dossier : chaque étape et chaque action, avec son heure. */
export function CaseLog({ received, log }: Props) {
  return (
    <Section title="Journal">
      <ol className="flex flex-col gap-2 text-[13px]">
        <Entry at={received.split(', ')[1] ?? received} event="Signalement reçu" />
        {log.map((entry, index) => (
          <Entry key={index} at={entry.at} event={entry.event} />
        ))}
      </ol>
    </Section>
  );
}

function Entry({ at, event }: { at: string; event: string }) {
  return (
    <li className="flex gap-3">
      <span className="tnum w-12 flex-none text-neutral-600">{at}</span>
      {event}
    </li>
  );
}
