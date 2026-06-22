import { en } from './en';
import { nl } from './nl';
import { Language } from './types';

export type { Language };

export const translations = {
  en,
  nl,
};

export function getTranslation(key: keyof typeof translations['en'], language: Language): string {
  return translations[language][key] || translations['en'][key] || '';
}
