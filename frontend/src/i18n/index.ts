import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LanguageDetectorAsyncModule } from 'i18next';

import bs from './locales/bs.json';
import en from './locales/en.json';

export const LANGUAGE_KEY = 'app_language';

const languageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  detect: async (): Promise<string> => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      return saved === 'en' ? 'en' : 'bs';
    } catch {
      return 'bs';
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch {}
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      bs: { translation: bs },
      en: { translation: en },
    },
    fallbackLng: 'bs',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
