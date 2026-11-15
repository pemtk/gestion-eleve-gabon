import { useState } from 'react';
import { Button, Field, Section, Textarea, Toggle } from '~/components/ui';

/** Étape 4 : clôture, avec une synthèse et l'accord de la directrice (obligatoire). */
export function ClosingStep({ onClose }: { onClose: (summary: string, agreed: boolean) => void }) {
  const [summary, setSummary] = useState('');
  const [agreed, setAgreed] = useState(false);
  return (
    <Section title="Clôture avec la directrice">
      <div className="flex flex-col gap-4">
        <Field label="Synthèse de la situation">
          <Textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <Toggle label="La directrice a donné son accord" checked={agreed} onChange={setAgreed} />
        <Button icon="lock-keyhole" disabled={!agreed} onClick={() => onClose(summary, agreed)}>
          Clore le signalement
        </Button>
      </div>
    </Section>
  );
}
