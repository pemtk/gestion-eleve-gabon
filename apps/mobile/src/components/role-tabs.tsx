import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C, F } from '@/theme';
import { Icon } from './icon';

export interface TabDef {
  name: string;
  label: string;
  icon: string;
  /** Pastille (non-lus) ; masquée à 0. */ badge?: number;
}

/** Barre d'onglets d'un profil (5 onglets au plus, comme le design). */
export function RoleTabs({ tabs }: { tabs: TabDef[] }) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarActiveTintColor: C.a[700],
        tabBarInactiveTintColor: C.n[600],
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.divider, height: 62 },
        tabBarLabel: ({ focused, children }) => (
          <Text
            style={{
              fontFamily: focused ? F.bodySemi : F.body,
              fontSize: 11,
              color: focused ? C.a[700] : C.n[600],
              marginBottom: 6,
            }}
          >
            {children}
          </Text>
        ),
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarIcon: ({ color }) => <Icon name={t.icon} size={22} color={color as string} />,
            tabBarAccessibilityLabel: t.badge
              ? `${t.label}, ${t.badge} non lu${t.badge > 1 ? 's' : ''}`
              : t.label,
            tabBarBadge: t.badge ? (t.badge > 99 ? '99+' : t.badge) : undefined,
            tabBarBadgeStyle: { backgroundColor: C.a[700], color: C.bg, fontSize: 11 },
          }}
        />
      ))}
    </Tabs>
  );
}
