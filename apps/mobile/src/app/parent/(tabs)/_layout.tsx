import { RoleTabs } from '@/components/role-tabs';
import { useUnread } from '@/lib/use-poll';

export default function ParentLayout() {
  const unread = useUnread();
  return (
    <RoleTabs
      tabs={[
        { name: 'index', label: 'Accueil', icon: 'house' },
        { name: 'activite', label: 'Activité', icon: 'chart-no-axes-column' },
        { name: 'alertes', label: 'Alertes', icon: 'bell' },
        { name: 'messages', label: 'Messages', icon: 'message-circle', badge: unread },
        { name: 'compte', label: 'Compte', icon: 'user' },
      ]}
    />
  );
}
