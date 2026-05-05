import { useFonts } from 'expo-font';
import { Gloock_400Regular } from '@expo-google-fonts/gloock';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { i18n } from '../src/i18n';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';
export const unstable_settings = { initialRouteName: '(tabs)' };

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Gloock: Gloock_400Regular,
    InstrumentSans_300: InstrumentSans_400Regular, // no 300 variant exists — use 400 with reduced opacity in styles
    InstrumentSans: InstrumentSans_400Regular,
    InstrumentSerif_Italic: InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    async function init() {
      await i18n.init();
      if (loaded) SplashScreen.hideAsync();
    }
    init();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
