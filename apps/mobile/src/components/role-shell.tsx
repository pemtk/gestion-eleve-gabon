import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/theme';
import { NetBar } from './net-bar';

/** Pile d'un profil : onglets en groupe « (tabs) », écrans de détail empilés au-dessus (sans barre d'onglets). */
export function RoleShell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <NetBar />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
    </View>
  );
}
