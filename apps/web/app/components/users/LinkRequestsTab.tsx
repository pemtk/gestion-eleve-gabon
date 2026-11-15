import { Avatar, Notice, Section, Tag } from '~/components/ui';
import type { UsersData } from './types';
import { LinkRequestActions } from './LinkRequestActions';

export function LinkRequestsTab({ d }: { d: UsersData }) {
  return (
    <>
      <Notice tone="info">
        Un code valide rattache le parent tout de suite. Les demandes ci-dessous attendent votre
        validation : code expiré, code déjà utilisé deux fois, ou numéro de parent inconnu de
        l’école.
      </Notice>
      <Section className="!p-0">
        {d.requests.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 border-b border-divider px-5 py-3.5 last:border-b-0"
          >
            <Avatar
              initials={r.parent
                .split(' ')
                .map((p) => p[0])
                .join('')}
              size={38}
            />
            <div className="min-w-0 flex-1 text-[14px]">
              <div>
                <span className="font-semibold">{r.parent}</span> · {r.relation} de{' '}
                <span className="font-semibold">{r.child}</span>
              </div>
              <div className="text-[12.5px] text-neutral-700">{r.meta}</div>
            </div>
            {r.decision ? (
              <Tag tone={r.decision === 'ok' ? 'hi' : 'n'}>
                {r.decision === 'ok' ? 'Validé · parent prévenu' : 'Refusé'}
              </Tag>
            ) : (
              <LinkRequestActions id={r.id} />
            )}
          </div>
        ))}
      </Section>
    </>
  );
}
