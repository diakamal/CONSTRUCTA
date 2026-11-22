// Field-friendly UI: big touch targets (≥ 64 px), high contrast for sunlight, minimal text.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = {
  bg: '#F4F1EA', card: '#FFFFFF', ink: '#1C2B39', muted: '#5B6770', line: '#E2DDD3',
  amber: '#F5A524', green: '#1E9E5A', red: '#C8372D', dark: '#1C2B39',
};

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <SafeAreaView style={[{ flex: 1, backgroundColor: C.bg }, style]}>{children}</SafeAreaView>;
}

export function BigButton({ label, onPress, tone = 'amber', disabled, busy, icon, testID }: {
  label: string; onPress: () => void; tone?: 'amber' | 'green' | 'red' | 'dark' | 'light';
  disabled?: boolean; busy?: boolean; icon?: string; testID?: string;
}) {
  const bg = { amber: C.amber, green: C.green, red: C.red, dark: C.dark, light: C.card }[tone];
  const fg = tone === 'amber' || tone === 'light' ? C.ink : '#fff';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.big, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        tone === 'light' && { borderWidth: 2, borderColor: C.line },
      ]}>
      {busy ? <ActivityIndicator color={fg} size="large" /> : (
        <Text style={[s.bigText, { color: fg }]}>{icon ? `${icon}  ` : ''}{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Banner({ text, tone = 'red', action }: { text: string; tone?: 'red' | 'amber' | 'green'; action?: ReactNode }) {
  const color = { red: C.red, amber: '#8A5A00', green: C.green }[tone];
  const bg = { red: '#FBE9E7', amber: '#FFF4DC', green: '#E3F5EA' }[tone];
  return (
    <View accessibilityRole="alert" style={[s.banner, { backgroundColor: bg }]}>
      <Text style={{ color, fontSize: 17, fontWeight: '600', textAlign: 'auto' }}>{text}</Text>
      {action}
    </View>
  );
}

export const s = StyleSheet.create({
  big: { minHeight: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  bigText: { fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: C.line },
  banner: { borderRadius: 14, padding: 14, gap: 10 },
  h1: { fontSize: 28, fontWeight: '800', color: C.ink },
  h2: { fontSize: 20, fontWeight: '700', color: C.ink },
  body: { fontSize: 17, color: C.ink },
  muted: { fontSize: 15, color: C.muted },
});
