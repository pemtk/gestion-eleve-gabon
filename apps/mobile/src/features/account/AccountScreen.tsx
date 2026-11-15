import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';
import { SUPPORT, initials } from '@sge/shared';
import { Icon } from '@/components/icon';
import { Avatar, B, Btn, H, Kicker, Muted, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { useRolePrefix } from '@/lib/use-role-prefix';
import { C, R } from '@/theme';

/* ---------------- Mon compte (§3.4) ---------------- */
export function AccountScreen() {
  const router = useRouter();
  const prefix = useRolePrefix();
  const { user, signOut } = useSession();
  const [push, setPush] = useState(true);
  const kids = useApi<{ id: string; name: string; school: string }[]>(
    user?.role === 'parent' ? '/me/parent/children' : null,
  );
  if (!user) return null;
  const parent = user.role === 'parent';
  const Item = ({
    icon,
    label,
    value,
    onPress,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: C.divider,
      }}
    >
      <Icon name={icon} size={19} color={C.a[700]} />
      <B style={{ flex: 1 }}>{label}</B>
      {value && <Muted size={12.5}>{value}</Muted>}
      <Icon name="chevron-right" size={17} color={C.n[500]} />
    </Pressable>
  );
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ gap: 6 }}>
      <Kicker>{title}</Kicker>
      <View
        style={{ borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }}
      >
        {children}
      </View>
    </View>
  );
  const go = (p: string) => () => router.push(`${prefix}/${p}` as '/');
  return (
    <Screen gap={20}>
      <View style={{ alignItems: 'center', gap: 4, paddingTop: 6 }}>
        <Avatar initials={user.initials} size={72} />
        <H size={26} semi>
          {user.name}
        </H>
        <Muted>+241 {user.phone.replace(/(\d{2})(?=\d)/g, '$1 ')}</Muted>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 2,
            borderRadius: 3,
            backgroundColor: C.a[100],
          }}
        >
          <B size={12} color={C.a[800]}>
            {user.title}
          </B>
        </View>
      </View>
      <Group title="Mon profil">
        <Item icon="user-pen" label="Nom et photo" onPress={go('profil')} />
        <Item icon="lock" label="Mot de passe" onPress={go('mot-de-passe')} />
      </Group>
      <Group title="Notifications">
        <View
          style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
          }}
        >
          <Icon name="bell" size={19} color={C.a[700]} />
          <B style={{ flex: 1 }}>Notifications push</B>
          <Switch
            value={push}
            onValueChange={setPush}
            trackColor={{ true: C.a[300], false: C.n[300] }}
            thumbColor={push ? C.accent : C.n[500]}
            accessibilityLabel="Notifications push"
          />
        </View>
        {parent && (
          <>
            <Item icon="message-square" label="Relais SMS" value="activé par l’école" />
            <Item icon="sliders-horizontal" label="Choisir mes alertes" onPress={go('alertes')} />
          </>
        )}
      </Group>
      <Group title="Établissements">
        {parent ? (
          (kids.data ?? []).map((k) => (
            <Item key={k.id} icon="school" label={k.school} value={k.name} />
          ))
        ) : (
          <Item
            icon="school"
            label={user.organization ?? 'Mon établissement'}
            value={user.role === 'enseignant' ? '3 classes' : '3ème B'}
          />
        )}
      </Group>
      <Group title="Aide">
        <Item icon="life-buoy" label="Aide et questions fréquentes" onPress={go('aide')} />
        <Item icon="headset" label="Contacter le support" onPress={go('aide')} />
        <Item
          icon="shield"
          label="Confidentialité"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT.email}?subject=Confidentialité`)}
        />
      </Group>
      <Btn variant="secondary" icon="log-out" label="Se déconnecter" onPress={signOut} />
      <Muted size={12} style={{ textAlign: 'center' }}>
        Version 1.0
      </Muted>
    </Screen>
  );
}
