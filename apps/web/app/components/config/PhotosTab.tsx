import { useState } from 'react';
import { Form } from 'react-router';
import { Button, Section, Toggle } from '~/components/ui';

/** §11.3 — les photos de preuve sont vues de l'enseignant ; le parent seulement si l'école le décide. */
export function PhotosTab({ proofVisibleToParents }: { proofVisibleToParents: boolean }) {
  const [parents, setParents] = useState(proofVisibleToParents);
  return (
    <Section title="Photos de preuve">
      <Form method="post" className="flex max-w-xl flex-col gap-4">
        <input type="hidden" name="intent" value="photos" />
        <p className="text-[14px] text-neutral-700">
          Quand un élève joint une photo de son cahier ou de son devoir, seul son enseignant la
          voit. La direction n’y a pas accès.
        </p>
        <Toggle
          name="proofVisibleToParents"
          label="Les parents voient les photos de leur enfant"
          sub="Désactivé par défaut"
          checked={parents}
          onChange={setParents}
        />
        <div>
          <Button type="submit" icon="save">
            Enregistrer
          </Button>
        </div>
      </Form>
    </Section>
  );
}
