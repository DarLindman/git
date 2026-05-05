import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import he from './he';

export type Lang = 'en' | 'he';
type Strings = typeof en;

const STORAGE_KEY = 'sw_lang';
const _strings: Record<Lang, Strings> = { en: en as Strings, he: he as unknown as Strings };

let _lang: Lang =
  Localization.getLocales()[0]?.languageCode === 'he' ? 'he' : 'en';

export const i18n = {
  t: (): Strings => _strings[_lang],
  lang: (): Lang => _lang,
  async setLang(lang: Lang) {
    _lang = lang;
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  },
  async init() {
    const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (saved === 'en' || saved === 'he') _lang = saved;
  },
};
