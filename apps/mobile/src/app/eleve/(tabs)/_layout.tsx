import { RoleTabs } from '@/components/role-tabs';

export default function EleveLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', label: 'Accueil', icon: 'house' },
        { name: 'taches', label: 'Tâches', icon: 'list-checks' },
        { name: 'resultats', label: 'Résultats', icon: 'award' },
        { name: 'messages', label: 'Messages', icon: 'message-circle' },
        { name: 'compte', label: 'Compte', icon: 'user' },
      ]}
    />
  );
}
