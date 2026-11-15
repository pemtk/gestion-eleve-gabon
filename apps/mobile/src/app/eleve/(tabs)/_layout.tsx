import { RoleTabs } from '@/components/role-tabs';
import { useUnread } from '@/lib/use-poll';

export default function EleveLayout() {
  const unread = useUnread();
  return (
    <RoleTabs
      tabs={[
        { name: 'index', label: 'Accueil', icon: 'house' },
        { name: 'taches', label: 'Tâches', icon: 'list-checks' },
        { name: 'resultats', label: 'Résultats', icon: 'award' },
        { name: 'messages', label: 'Messages', icon: 'message-circle', badge: unread },
        { name: 'compte', label: 'Compte', icon: 'user' },
      ]}
    />
  );
}
