import { Pressable, View } from 'react-native';
import { C } from '@/theme';
import { useSession } from '@/lib/session';
import { B } from './ui';
import { Icon } from './icon';

/** Indicateur réseau et file d'attente : le hors-ligne se voit toujours (bandeau + compteur « en attente »). */
export function NetBar() {
  const { offline, setOffline, pending } = useSession();
  return (
    <View style={{ backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 6 }}>
        <Pressable onPress={() => setOffline(!offline)} accessibilityRole="button" accessibilityLabel="Simuler le mode hors ligne" hitSlop={8} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 32 }}>
          <Icon name={offline ? 'wifi-off' : 'wifi'} size={15} color={offline ? C.a[800] : C.n[700]} />
          <B size={12} color={offline ? C.a[800] : C.n[700]}>{offline ? 'Hors ligne' : 'En ligne'}</B>
        </Pressable>
      </View>
      {(offline || pending > 0) && (
        <View accessibilityLiveRegion="polite" style={{ marginHorizontal: 14, marginBottom: 6, padding: 10, borderRadius: 7, backgroundColor: C.a[100], borderWidth: 1, borderColor: C.a[300], flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon name="cloud-off" size={17} color={C.a[800]} />
          <B size={12.5} color={C.a[800]} style={{ flex: 1 }}>{offline ? 'Hors ligne. Vos actions sont gardées et partiront dès le retour du réseau.' : 'Synchronisation en cours…'}</B>
          <B size={12.5} semi color={C.a[800]}>{pending} en attente</B>
        </View>
      )}
    </View>
  );
}
