import { Form } from 'react-router';
import { Icon } from '~/components/icon';
import { Button, Field, Input, Section, Tag, cx, toneOf } from '~/components/ui';
import type { UsersData } from './types';
import { ResendInviteButton } from './ResendInviteButton';

export function TeachersTab({ d }: { d: UsersData }) {
  return (
    <>
      <Section>
        <Form method="post" className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="intent" value="invite" />
          <Field label="Prénom et nom">
            <Input name="name" placeholder="Ex. Rachel Nziengui" required />
          </Field>
          <Field label="Téléphone">
            <Input name="phone" inputMode="tel" placeholder="+241 07 …" required />
          </Field>
          <Button type="submit" icon="send" disabled={!d.sms}>
            Inviter par SMS
          </Button>
        </Form>
        {!d.sms && (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-accent-800">
            <Icon name="lock" size={14} />
            Invitations par SMS incluses à partir de la formule Standard.
          </div>
        )}
      </Section>
      <Section className="overflow-x-auto !p-0">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[1.2fr_1fr_1.8fr_1fr_.7fr] border-b border-divider px-2 text-[11px] tracking-[.08em] text-neutral-700 uppercase">
            {['Enseignant', 'Téléphone', 'Affectations', 'Statut', ''].map((h, i) => (
              <div key={i} className="px-2 py-2.5">
                {h}
              </div>
            ))}
          </div>
          {d.teachers.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[1.2fr_1fr_1.8fr_1fr_.7fr] items-center border-b border-divider px-2 py-2.5 text-[13.5px]"
            >
              <div className="px-2">{t.name}</div>
              <div className="tnum px-2">{t.phone}</div>
              <div
                className={cx(
                  'px-2',
                  t.assignments ? 'text-neutral-700' : 'italic text-accent-800',
                )}
              >
                {t.assignments || 'aucune affectation'}
              </div>
              <div className="px-2">
                <Tag tone={toneOf(t.status)}>{t.status}</Tag>
              </div>
              <div className="px-2">
                {t.status !== 'Activé' && <ResendInviteButton id={t.id} />}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
