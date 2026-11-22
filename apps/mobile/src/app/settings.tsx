import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SUPPORTED_LANGUAGES } from '@constructa/shared';
import { BigButton, C, Card, Screen, s } from '@/components/ui';
import { api, saveSession } from '@/lib/api';
import { setLanguage } from '@/lib/i18n';
import { getDemoLocation, setDemoLocation } from '@/lib/location';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [demo, setDemo] = useState(false);

  useEffect(() => { getDemoLocation().then(setDemo); }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
        <BigButton label={`‹ ${t('back')}`} tone="light" onPress={() => router.back()} />
        <Text style={s.h1}>{t('settings')}</Text>

        <Card>
          <Text style={s.h2}>🌐 {t('language')}</Text>
          <View style={{ gap: 10 }}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <BigButton key={l.code} label={l.label} tone={i18n.language === l.code ? 'amber' : 'light'}
                onPress={async () => { await setLanguage(l.code); api.setMyLanguage(l.code).catch(() => {}); }} />
            ))}
          </View>
        </Card>

        <Card style={{ borderColor: C.amber, borderWidth: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={[s.h2, { flex: 1, fontSize: 18 }]}>🧪 {t('demoLocation')}</Text>
            <View style={{ width: 60, alignItems: 'center' }}>
              <Switch testID="demo-location" value={demo} onValueChange={(v) => { setDemo(v); setDemoLocation(v); }} />
            </View>
          </View>
          <Text style={s.muted}>{t('demoLocationHint')}</Text>
        </Card>

        <BigButton label={t('logout')} tone="red" onPress={async () => { await saveSession(null); router.replace('/login'); }} />
      </ScrollView>
    </Screen>
  );
}
