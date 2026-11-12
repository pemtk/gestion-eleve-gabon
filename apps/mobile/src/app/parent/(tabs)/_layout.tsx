import { RoleTabs } from '@/components/role-tabs';

export default function ParentLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', label: 'Accueil', icon: 'house' },
        { name: 'activite', label: 'Activité', icon: 'chart-no-axes-column' },
        { name: 'alertes', label: 'Alertes', icon: 'bell' },
        { name: 'messages', label: 'Messages', icon: 'message-circle' },
        { name: 'compte', label: 'Compte', icon: 'user' },
      ]}
    />
  );
}
