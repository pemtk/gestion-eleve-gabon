import { Icon } from '../icon';
import { Kicker, Section, LinkButton } from '../ui';

/** Fonction non incluse dans la formule de l'établissement. */
export function LockedCard({
  plan,
  title,
  text,
  ctaTo = '/ecole/abonnement',
}: {
  plan: string;
  title: string;
  text: string;
  ctaTo?: string;
}) {
  return (
    <Section dashed className="flex flex-col items-start gap-3 !p-6">
      <div className="flex items-center gap-2.5">
        <div className="grid h-[38px] w-[38px] place-items-center rounded-full border border-accent-400 text-accent-700">
          <Icon name="lock" size={17} />
        </div>
        <Kicker>Formule {plan}</Kicker>
      </div>
      <h2 className="text-2xl">{title}</h2>
      <p className="max-w-prose text-[14px] leading-relaxed text-neutral-700">{text}</p>
      <div className="flex flex-wrap gap-2">
        <LinkButton to={ctaTo}>Comparer les formules</LinkButton>
      </div>
    </Section>
  );
}
