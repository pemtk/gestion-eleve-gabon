import { B, Header, Screen } from '@/components/ui';
import { C } from '@/theme';

/** Message affiché quand l'enseignant n'a aucune classe affectée. */
export const NoClassNotice = () => (
  <Screen>
    <Header title="Aucune classe" />
    <B color={C.n[700]}>
      Aucune classe ne vous est encore affectée. Contactez l’administration de l’école.
    </B>
  </Screen>
);
