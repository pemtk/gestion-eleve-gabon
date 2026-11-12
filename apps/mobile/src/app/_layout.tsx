import { CormorantGaramond_400Regular, CormorantGaramond_400Regular_Italic, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond';
import { Lora_400Regular, Lora_400Regular_Italic, Lora_600SemiBold, useFonts } from '@expo-google-fonts/lora';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from '@/theme';
import { HOME, SessionProvider, useSession } from '@/lib/session';

void SplashScreen.preventAutoHideAsync();

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { ready, user } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const inAuth = segments[0] === '(auth)';

  useEffect(() => {
    if (!ready || !fontsReady) return;
    void SplashScreen.hideAsync();
    if (!user && !inAuth) router.replace('/login');
    else if (user && inAuth && HOME[user.role]) router.replace(HOME[user.role] as '/');
  }, [ready, fontsReady, user, inAuth, router]);

  if (!ready || !fontsReady) return null;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}

export default function RootLayout() {
  // Cormorant Garamond (titres) et Lora (texte), comme le système Classical.
  const [loaded] = useFonts({
    CormorantGaramond_400Regular, CormorantGaramond_400Regular_Italic, CormorantGaramond_600SemiBold,
    Lora_400Regular, Lora_400Regular_Italic, Lora_600SemiBold,
  });
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Gate fontsReady={loaded} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
