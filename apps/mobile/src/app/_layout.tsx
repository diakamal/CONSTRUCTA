import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { loadSession } from '@/lib/api';
import { initI18n } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([initI18n(), loadSession()]).finally(() => {
      setReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

  if (!ready) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F4F1EA' } }} />
    </>
  );
}
