import { useFetcher } from 'react-router';
import { Button } from '~/components/ui';

export function ResendInviteButton({ id }: { id: string }) {
  const f = useFetcher();
  return (
    <f.Form method="post" action="/ecole/utilisateurs?tab=profs">
      <input type="hidden" name="intent" value="resend" />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost">
        Relancer
      </Button>
    </f.Form>
  );
}
