// Phone + SMS code. Only numbers the manager invited can sign in.
// Mock: no SMS is sent; the code is always 123456 (Supabase: signInWithOtp / verifyOtp).
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Banner, BigButton, C, Screen, s } from '@/components/ui';
import { api, errorKey, saveSession } from '@/lib/api';
import { setLanguage } from '@/lib/i18n';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const showError = (e: unknown) => { const k = errorKey(e); setError(t(k.key, k.params)); };

  async function sendCode() {
    setBusy(true); setError('');
    try { await api.requestOtp(phone); setStep('code'); } catch (e) { showError(e); } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError('');
    try {
      const profile = await api.verifyOtp(phone, code);
      await saveSession(profile);
      await setLanguage(profile.language); // manager set the worker's language on the invitation
      router.replace('/today');
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 18 }}>
        <Text style={[s.h1, { textAlign: 'center', letterSpacing: 3 }]}>CONSTRUCTA</Text>

        {step === 'phone' ? (
          <View style={{ gap: 10 }}>
            <Text style={s.h2}>📱 {t('phoneLabel')}</Text>
            <TextInput
              testID="phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+972 50 000 0000"
              style={styles.input}
            />
            <BigButton label={t('sendCode')} onPress={sendCode} busy={busy} disabled={phone.replace(/\D/g, '').length < 9} testID="send-code" />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={s.h2}>🔑 {t('codeLabel')}</Text>
            <TextInput
              testID="code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              placeholder="••••••"
              style={[styles.input, { letterSpacing: 10, textAlign: 'center' }]}
            />
            <BigButton label={t('verify')} onPress={verify} busy={busy} disabled={code.length !== 6} testID="verify" />
            <Pressable onPress={() => { setStep('phone'); setCode(''); setError(''); }} style={{ padding: 12 }}>
              <Text style={[s.muted, { textAlign: 'center', textDecorationLine: 'underline' }]}>{t('changeNumber')}</Text>
            </Pressable>
            <Text style={[s.muted, { textAlign: 'center' }]}>{t('demoCodeHint')}</Text>
          </View>
        )}

        {!!error && <Banner text={error} />}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: C.card, borderWidth: 2, borderColor: C.line, borderRadius: 16, minHeight: 64,
    paddingHorizontal: 18, fontSize: 24, color: C.ink, writingDirection: 'ltr', textAlign: 'left',
  },
});
