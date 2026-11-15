import { useFetcher } from 'react-router';
import { Button } from '~/components/ui';

export function LinkRequestActions({ id }: { id: string }) {
  const f = useFetcher();
  return (
    <f.Form method="post" action="/ecole/utilisateurs?tab=ratt" className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="intent" value="refuse" variant="secondary">
        Refuser
      </Button>
      <Button type="submit" name="intent" value="accept">
        Valider
      </Button>
    </f.Form>
  );
}
