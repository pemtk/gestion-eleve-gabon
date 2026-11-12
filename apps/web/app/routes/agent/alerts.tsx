import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Section } from '~/components/ui';
import { spaceApi } from '~/lib/api.server';
import type { Route } from './+types/alerts';

export async function loader({ request }: Route.LoaderArgs) {
  return { alerts: await (await spaceApi(request, 'agent')).get<{ icon: string; text: string }[]>('/agent/alerts') };
}

export default function Alerts({ loaderData: d }: Route.ComponentProps) {
  return (
    <>
      <PageHeader kicker="Province de l’Estuaire" title="Alertes" />
      <Section title="À surveiller cette semaine" note="retards de saisie, faible activation">
        {d.alerts.map((a) => <div key={a.text} className="flex items-center gap-3 border-t border-divider py-3 text-[14px]"><Icon name={a.icon} size={17} className="text-accent-700" />{a.text}</div>)}
      </Section>
    </>
  );
}
