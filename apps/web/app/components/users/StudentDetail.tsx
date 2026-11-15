import { useFetcher } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { Avatar, Button, Notice, Section } from '~/components/ui';
import type { StudentRow } from '~/lib/types';

export function StudentDetail({ s, sms }: { s: StudentRow; sms: boolean }) {
  const f = useFetcher<{ ok: boolean; message?: string; error?: string }>();
  const act = (intent: string, label: string, icon: string, locked = false) => (
    <f.Form method="post" action="/ecole/utilisateurs?tab=eleves" className="flex-1">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={s.id} />
      <Button
        type="submit"
        variant="secondary"
        icon={locked ? 'lock' : icon}
        disabled={locked}
        className="w-full !text-[14px]"
      >
        {label}
      </Button>
    </f.Form>
  );
  return (
    <Section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar initials={s.initials} size={44} />
        <div>
          <div className="font-heading text-[22px] leading-tight font-semibold">
            {s.firstName} {s.lastName}
          </div>
          <div className="text-[12.5px] text-neutral-700">
            {s.className} · {s.phone ? `+241 ${s.phone}` : 'pas de téléphone'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-lg border border-accent-300 bg-accent-100 p-3.5">
        <div className="rounded-md bg-white p-2" aria-label={`QR code du code ${s.codeLabel}`}>
          <QRCodeSVG value={`sge://rattachement?code=${s.code}`} size={84} />
        </div>
        <div>
          <div className="text-[11px] tracking-[.1em] text-accent-700 uppercase">
            Code d’invitation parent
          </div>
          <div className="tnum font-heading text-[34px] leading-none text-accent-800">
            {s.codeLabel}
          </div>
          <div className="mt-1 text-[11.5px] text-accent-800">
            Valable jusqu’au 31/12/2026 · 2 parents au maximum
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon="printer"
          className="flex-1 !text-[14px]"
          onClick={() => window.print()}
        >
          Imprimer la fiche
        </Button>
        {act('sendCode', 'Envoyer par SMS', 'message-square', !sms)}
      </div>
      <div>
        <div className="mb-1 text-[11px] tracking-[.1em] text-accent-700 uppercase">
          Parents rattachés
        </div>
        {s.parents.map((p) => (
          <div
            key={p.name}
            className="flex justify-between border-t border-divider py-2 text-[14px]"
          >
            <span>{p.name}</span>
            <span className="text-neutral-700">{p.relation}</span>
          </div>
        ))}
        {!s.parents.length && (
          <div className="border-t border-divider py-2 text-[13.5px] italic text-accent-800">
            Aucun parent rattaché : remettez la fiche.
          </div>
        )}
      </div>
      {act('regenerate', 'Régénérer le code (l’ancien ne fonctionnera plus)', 'refresh-cw')}
      {f.data && !f.data.ok && <Notice tone="error">{f.data.error}</Notice>}
      {f.data?.ok && <Notice>{f.data.message}</Notice>}
    </Section>
  );
}
