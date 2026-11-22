import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SUPPORTED_LANGUAGES } from '@constructa/shared';
import { BigButton, Screen, s } from '@/components/ui';
import { api, loadSession } from '@/lib/api';
import { setLanguage } from '@/lib/i18n';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();

  return (
    <Screen style={{ padding: 24, justifyContent: 'center' }}>
      <Text style={[s.h1, { textAlign: 'center', letterSpacing: 3 }]}>CONSTRUCTA</Text>
      <Text style={[s.h2, { textAlign: 'center', marginTop: 8, marginBottom: 32 }]}>🌐 {t('chooseLanguage')}</Text>
      <View style={{ gap: 16 }}>
        {SUPPORTED_LANGUAGES.map((l) => (
          <BigButton
            key={l.code}
            label={l.label}
            tone={i18n.language === l.code ? 'amber' : 'light'}
            onPress={async () => {
              await setLanguage(l.code);
              const signedIn = await loadSession();
              if (signedIn) api.setMyLanguage(l.code).catch(() => {});
              router.replace(signedIn ? '/today' : '/login');
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
