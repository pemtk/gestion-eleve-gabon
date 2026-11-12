import { useFetcher } from 'react-router';
import { Icon } from '~/components/icon';
import { PageHeader } from '~/components/blocks';
import { Button, Kicker, Notice, Section, Tag, cx } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import { PLAN_FEATURES, PLAN_ORDER, formatInt } from '@sge/shared';
import type { SubscriptionInfo } from '~/lib/types';
import { useSchoolName } from '~/lib/school';
import type { Route } from './+types/subscription';

export async function loader({ request }: Route.LoaderArgs) {
  return (await spaceApi(request, 'ecole')).get<SubscriptionInfo>('/school/subscription');
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  if (str(fd, 'intent') === 'cancel') return run(() => api.del('/school/subscription/request'), 'Demande annulée.');
  return run(() => api.post('/school/subscription/request', { plan: str(fd, 'plan') }), `Demande envoyée pour la formule ${str(fd, 'plan')}. L’administration la validera.`);
}

export default function Subscription({ loaderData: s }: Route.ComponentProps) {
  const school = useSchoolName();
  const f = useFetcher<{ ok: boolean; error?: string; message?: string }>();
  return (
    <>
      <PageHeader kicker={school} title="Mon abonnement" />
      {f.data?.ok && <Notice>{f.data.message}</Notice>}
      {f.data && !f.data.ok && <Notice tone="error">{f.data.error}</Notice>}
      {s.requestedPlan && (
        <Notice tone="info">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1">Passage à la formule {s.requestedPlan} demandé · en attente de validation par l’administration.</span>
            <f.Form method="post"><input type="hidden" name="intent" value="cancel" /><Button type="submit" variant="ghost">Annuler la demande</Button></f.Form>
          </div>
        </Notice>
      )}
      <Section className="flex flex-wrap items-center gap-6">
        <div className="flex-1">
          <Kicker>Formule actuelle</Kicker>
          <div className="flex items-center gap-3"><span className="font-heading text-[36px] leading-tight">{s.plan}</span><Tag tone={s.suspended ? 'warn' : 'hi'}>{s.suspended ? 'Suspendu' : 'Actif'}</Tag></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-[14px]">
          <dt className="text-neutral-700">Tarif</dt><dd className="tnum">{formatInt(s.price)} FCFA / an</dd>
          <dt className="text-neutral-700">Échéance</dt><dd>{s.dueDate}</dd>
          <dt className="text-neutral-700">Rattachée à</dt><dd>Diocèse de Libreville</dd>
        </dl>
      </Section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {s.plans.map((p) => {
          const off = p.current || p.requested;
          return (
            <div key={p.plan} className={cx('flex flex-col gap-3 rounded-lg p-4', p.current ? 'border-[1.5px] border-accent bg-accent-100' : 'border border-divider')}>
              <div className="flex items-center justify-between"><h2 className="text-[24px]">{p.plan}</h2>{(p.current || p.requested) && <Tag tone="hi">{p.current ? 'Actuelle' : 'Demandée'}</Tag>}</div>
              <div className="tnum font-heading text-[26px] leading-none">{formatInt(p.price)}<span className="font-body text-[12px] text-neutral-700"> FCFA / an</span></div>
              <ul className="flex flex-1 flex-col gap-1.5 text-[13px]">
                {PLAN_FEATURES.map(([label, min]) => {
                  const has = PLAN_ORDER.indexOf(p.plan) >= min;
                  return <li key={label} className={cx('flex gap-2', !has && 'text-neutral-500')}><Icon name={has ? 'check' : 'minus'} size={14} className={cx('mt-0.5 flex-none', has ? 'text-accent-700' : 'text-neutral-400')} />{label}</li>;
                })}
              </ul>
              <f.Form method="post">
                <input type="hidden" name="plan" value={p.plan} />
                <Button type="submit" variant="secondary" disabled={off} className={cx('w-full', !off && '!border-accent !text-accent-800')}>
                  {p.current ? 'Formule actuelle' : p.requested ? 'Demande envoyée' : p.upgrade ? 'Demander cette formule' : 'Passer à cette formule'}
                </Button>
              </f.Form>
            </div>
          );
        })}
      </div>
    </>
  );
}
