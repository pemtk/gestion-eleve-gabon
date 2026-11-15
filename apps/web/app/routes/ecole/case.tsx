import { useFetcher } from 'react-router';
import { CASE_STEPS, type ConfidentialCase } from '@sge/shared';
import { PageHeader } from '~/components/blocks';
import { AcknowledgeStep } from '~/components/case/AcknowledgeStep';
import { ActionPlanStep } from '~/components/case/ActionPlanStep';
import { CaseLog } from '~/components/case/CaseLog';
import { CaseStepper } from '~/components/case/CaseStepper';
import { CaseSummary } from '~/components/case/CaseSummary';
import { ClosingStep } from '~/components/case/ClosingStep';
import { EvaluationStep } from '~/components/case/EvaluationStep';
import type { CaseState } from '~/components/case/types';
import { LinkButton, Notice } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { flag, str } from '~/lib/form';
import type { Route } from './+types/case';

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  return api.get<{ info: ConfidentialCase; state: CaseState }>(
    `/school/cases/${encodeURIComponent(params.caseId)}`,
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  const base = `/school/cases/${encodeURIComponent(params.caseId)}`;
  switch (str(fd, 'intent')) {
    case 'ack':
      return run(() => api.post(`${base}/acknowledge`), 'Accusé de réception envoyé.');
    case 'evaluate':
      return run(
        () =>
          api.post(`${base}/evaluate`, {
            gravity: str(fd, 'gravity'),
            measures: str(fd, 'measures'),
            informDirector: flag(fd, 'informDirector'),
            informFamily: flag(fd, 'informFamily'),
          }),
        'Évaluation enregistrée.',
      );
    case 'addAction':
      return run(
        () => api.post(`${base}/actions`, { label: str(fd, 'label'), owner: str(fd, 'owner') }),
        'Action ajoutée.',
      );
    case 'toggle':
      return run(
        () => api.post(`${base}/actions/${str(fd, 'index')}/toggle`),
        'Action mise à jour.',
      );
    case 'prepareClose':
      return run(() => api.post(`${base}/prepare-close`), 'Dossier prêt pour la clôture.');
    case 'close':
      return run(
        () =>
          api.post(`${base}/close`, {
            summary: str(fd, 'summary'),
            directorAgreement: flag(fd, 'directorAgreement'),
          }),
        'Signalement clos avec l’accord de la directrice.',
      );
  }
  return null;
}

/** Délai ou précision de chaque étape du protocole (§11.2). */
const STEP_HINTS = ['sous 4 h', 'sous 24 h', 'suivi des mesures', 'avec la directrice'];

/** Traitement d'un signalement confidentiel : une étape à la fois, chaque action est tracée par l'API. */
export default function Case({ loaderData: { info, state } }: Route.ComponentProps) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const post = (intent: string, fields?: Record<string, string>) =>
    fetcher.submit({ intent, ...fields }, { method: 'post' });

  return (
    <>
      <PageHeader
        kicker="Vie scolaire › Signalement confidentiel"
        title={`Dossier #${info.id}`}
        action={
          <LinkButton variant="secondary" to="/ecole/vie-scolaire" icon="arrow-left">
            Retour aux signalements
          </LinkButton>
        }
      />
      {fetcher.data && !fetcher.data.ok && <Notice tone="error">{fetcher.data.error}</Notice>}
      <CaseStepper steps={CASE_STEPS} hints={STEP_HINTS} current={state.step} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {state.step === 1 && <AcknowledgeStep onAcknowledge={() => post('ack')} />}
          {state.step === 2 && (
            <EvaluationStep
              initialGravity={state.gravity}
              onSubmit={(values) =>
                post('evaluate', {
                  gravity: values.gravity,
                  measures: values.measures,
                  informDirector: String(values.informDirector),
                  informFamily: String(values.informFamily),
                })
              }
            />
          )}
          {state.step === 3 && (
            <ActionPlanStep
              actions={state.actions}
              onToggle={(index) => post('toggle', { index: String(index) })}
              onAdd={(label, owner) => post('addAction', { label, owner })}
              onPrepareClose={() => post('prepareClose')}
            />
          )}
          {state.step === 4 && (
            <ClosingStep
              onClose={(summary, agreed) =>
                post('close', { summary, directorAgreement: String(agreed) })
              }
            />
          )}
          {state.step === 5 && <Notice>Signalement clos avec l’accord de la directrice.</Notice>}
        </div>
        <div className="flex flex-col gap-5">
          <CaseSummary info={info} />
          <CaseLog received={info.received} log={state.log} />
        </div>
      </div>
    </>
  );
}
