import { useState } from 'react';
import { Form, redirect, useNavigation } from 'react-router';
import { ROLE_LABELS, WEB_HOME, WEB_ROLES, WEB_SPACE_OF, type Role, type SessionUser } from '@sge/shared';
import { Icon } from '~/components/icon';
import { Button, Chips, Field, Input, Notice, Kicker, cx } from '~/components/ui';
import { ApiError, publicApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import { createUserSession, getSession } from '~/lib/session.server';
import type { Route } from './+types/login';

type Session = { accessToken: string; user: SessionUser };
const demoEnabled = () => process.env.NODE_ENV !== 'production' || process.env.DEMO_LOGIN === 'true';

export async function loader({ request }: Route.LoaderArgs) {
  const user = (await getSession(request)).get('user');
  const space = user && WEB_SPACE_OF[user.role];
  if (space) throw redirect(WEB_HOME[space]);
  return { demo: demoEnabled() };
}

export async function action({ request }: Route.ActionArgs) {
  const fd = await request.formData();
  const intent = str(fd, 'intent');
  try {
    let session: Session | undefined;
    if (intent === 'demo' && demoEnabled()) {
      session = await publicApi.post<Session>(`/auth/demo/${str(fd, 'role')}`);
    } else if (intent === 'verify') {
      session = await publicApi.post<Session>('/auth/otp/verify', { phone: str(fd, 'phone'), code: str(fd, 'code') });
    } else {
      const mode = str(fd, 'mode') === 'otp' ? 'otp' : 'password';
      const res = await publicApi.post<Session | { otpRequired: true }>('/auth/login', { mode, phone: str(fd, 'phone'), password: str(fd, 'password') });
      if ('otpRequired' in res) return { step: 'otp' as const, phone: str(fd, 'phone'), error: null };
      session = res;
    }
    if (!WEB_SPACE_OF[session.user.role]) {
      return { step: 'login' as const, phone: '', error: `Le profil ${ROLE_LABELS[session.user.role].toLowerCase()} utilise l’application mobile.` };
    }
    return await createUserSession(session.accessToken, session.user);
  } catch (e) {
    if (e instanceof Response) throw e;
    if (e instanceof ApiError) return { step: intent === 'verify' ? ('otp' as const) : ('login' as const), phone: str(fd, 'phone'), error: e.message };
    throw e;
  }
}

const WEB_DEMO_ROLES: Role[] = WEB_ROLES.filter((r) => WEB_SPACE_OF[r]);
const MODES = ['Mot de passe', 'Code SMS'];

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  const busy = nav.state !== 'idle';
  const [mode, setMode] = useState(MODES[0]!);
  const otp = actionData?.step === 'otp';

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between border-r border-divider bg-neutral-100 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full border-[1.5px] border-accent font-heading text-[22px] italic text-accent-700">Sg</div>
          <div className="font-heading text-[17px] leading-tight font-semibold">Suivi et Gestion<br />des Élèves</div>
        </div>
        <div>
          <Kicker>Plateforme multiprofil · Gabon</Kicker>
          <h1 className="mt-3 text-[64px] leading-[1.02] font-normal">Piloter l’école,<br /><span className="italic">sans papier.</span></h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-neutral-700">Établissements, agents, partenaires et équipe plateforme suivent l’engagement des élèves, les absences et les résultats au même endroit.</p>
        </div>
        <p className="text-[12px] text-neutral-600">Les élèves, parents et enseignants utilisent l’application mobile.</p>
      </div>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div>
            <h2 className="text-[40px] leading-none font-normal">{otp ? 'Code de vérification' : 'Bonjour !'}</h2>
            <p className="mt-2 text-[15px] text-neutral-700">{otp ? 'Saisissez le code reçu par SMS.' : 'Connectez-vous avec votre numéro de téléphone.'}</p>
          </div>

          {actionData?.error && <Notice tone="error">{actionData.error}</Notice>}

          {otp ? (
            <Form method="post" className="flex flex-col gap-4">
              <input type="hidden" name="intent" value="verify" />
              <input type="hidden" name="phone" value={actionData.phone} />
              <Field label="Code à 6 chiffres" hint="Pas de code ? Attendez une minute avant d’en redemander un.">
                <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required className="tnum !min-h-13 text-center font-heading text-[28px] tracking-[.3em]" />
              </Field>
              <Button type="submit" disabled={busy} className="!min-h-13 text-[19px]">Valider</Button>
            </Form>
          ) : (
            <Form method="post" className="flex flex-col gap-4">
              <Field label="Numéro de téléphone">
                <div className="flex gap-2">
                  <div className="tnum flex min-h-12 items-center rounded-md border border-divider px-3.5">+241</div>
                  <Input name="phone" inputMode="tel" autoComplete="username" placeholder="07 00 00 00" required className="tnum !min-h-12 flex-1 text-[16px]" />
                </div>
              </Field>
              <Chips name="mode-ui" options={MODES} value={mode} onChange={setMode} />
              <input type="hidden" name="mode" value={mode === MODES[1] ? 'otp' : 'password'} />
              {mode === MODES[0] ? (
                <Field label="Mot de passe">
                  <Input name="password" type="password" autoComplete="current-password" required className="!min-h-12" />
                </Field>
              ) : (
                <p className="text-[14px] text-neutral-700">Nous vous envoyons un code à 6 chiffres par SMS. Pas besoin de mot de passe.</p>
              )}
              <Button type="submit" disabled={busy} icon="arrow-right" className="!min-h-13 text-[19px]">{mode === MODES[0] ? 'Connexion' : 'Recevoir le code'}</Button>
            </Form>
          )}

          {loaderData.demo && !otp && (
            <div className="flex flex-col gap-2.5 border-t border-divider pt-5">
              <Kicker>Démo — choisir un profil</Kicker>
              <Form method="post" className="grid grid-cols-2 gap-2">
                <input type="hidden" name="intent" value="demo" />
                {WEB_DEMO_ROLES.map((r) => (
                  <button key={r} name="role" value={r} type="submit" disabled={busy}
                    className={cx('flex min-h-11 items-center justify-center gap-2 rounded-md border border-divider text-[13.5px] hover:bg-accent-100')}>
                    <Icon name={r === 'etablissement' ? 'school' : r === 'agent' ? 'building-2' : r === 'partenaire' ? 'chart-no-axes-column' : 'user-cog'} size={15} />
                    {ROLE_LABELS[r].replace(' institutionnel', '').replace(' plateforme', '')}
                  </button>
                ))}
              </Form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
