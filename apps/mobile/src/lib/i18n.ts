import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';
import { isRtl, resources, type Language } from '@constructa/shared';

const LANG_KEY = 'constructa.language';

const deviceLanguage = (): Language => {
  const code = getLocales()[0]?.languageCode;
  return code === 'ar' || code === 'th' || code === 'en' ? code : 'he';
};

function applyDirection(lang: Language) {
  if (Platform.OS === 'web') {
    // On web, direction is a document attribute; I18nManager does nothing there.
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return;
  }
  I18nManager.allowRTL(true);
  // Native layout direction switches on the next app start.
  if (I18nManager.isRTL !== isRtl(lang)) I18nManager.forceRTL(isRtl(lang));
}

export async function initI18n() {
  let lang: Language = deviceLanguage();
  try {
    lang = ((await AsyncStorage.getItem(LANG_KEY)) as Language | null) ?? lang;
  } catch {}
  await i18n.use(initReactI18next).init({
    resources: Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, { translation: v }])),
    lng: lang,
    fallbackLng: 'he',
    interpolation: { escapeValue: false },
  });
  applyDirection(lang);
  return lang;
}

export async function setLanguage(lang: Language) {
  await i18n.changeLanguage(lang);
  try { await AsyncStorage.setItem(LANG_KEY, lang); } catch {}
  applyDirection(lang);
}

export async function hasChosenLanguage() {
  try { return (await AsyncStorage.getItem(LANG_KEY)) !== null; } catch { return false; }
}

/** True when the UI language is RTL (use for row direction / text alignment). */
export const rtl = () => isRtl(i18n.language as Language);

export default i18n;
