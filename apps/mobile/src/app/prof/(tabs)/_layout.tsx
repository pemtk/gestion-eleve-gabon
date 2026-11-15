import { RoleTabs } from '@/components/role-tabs';
import { useUnread } from '@/lib/use-poll';

export default function ProfLayout() {
  const unread = useUnread();
  return (
    <RoleTabs
      tabs={[
        { name: 'index', label: 'Classes', icon: 'house' },
        { name: 'appel', label: 'Appel', icon: 'calendar-check' },
        { name: 'notes', label: 'Notes', icon: 'pen-line' },
        { name: 'messages', label: 'Messages', icon: 'message-circle', badge: unread },
        { name: 'compte', label: 'Compte', icon: 'user' },
      ]}
    />
  );
}
