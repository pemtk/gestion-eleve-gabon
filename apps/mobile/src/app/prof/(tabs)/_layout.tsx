import { RoleTabs } from '@/components/role-tabs';

export default function ProfLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', label: 'Classes', icon: 'house' },
        { name: 'appel', label: 'Appel', icon: 'calendar-check' },
        { name: 'notes', label: 'Notes', icon: 'pen-line' },
        { name: 'messages', label: 'Messages', icon: 'message-circle' },
        { name: 'compte', label: 'Compte', icon: 'user' },
      ]}
    />
  );
}
