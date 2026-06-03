// src/lib/i18n/config.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '../../../public/locales/en/common.json'
import ur from '../../../public/locales/ur/common.json'

const SUPPORTED_LANGS = ['en', 'ur'] as const
export type SupportedLocale = (typeof SUPPORTED_LANGS)[number]

export function isSupportedLocale(lang: string): lang is SupportedLocale {
  return SUPPORTED_LANGS.includes(lang as SupportedLocale)
}

export function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'ur'
  const stored = localStorage.getItem('md-locale')
  if (stored && isSupportedLocale(stored)) return stored
  const browser = navigator.language?.slice(0, 2)
  if (browser && isSupportedLocale(browser)) return browser
  return 'ur'
}

export function getLocaleDir(locale: SupportedLocale): 'ltr' | 'rtl' {
  // Urdu is intentionally rendered in LTR layouts for this app so switching
  // languages does not mirror the operational UI.
  void locale
  return 'ltr'
}

// Initialize i18next
export function initI18n(defaultLocale: SupportedLocale) {
  if (i18n.isInitialized) return i18n

  i18n
    .use(initReactI18next)
    .use(LanguageDetector)
    .init({
      resources: {
        en: { common: en },
        ur: { common: ur },
      },
      lng: defaultLocale,
      fallbackLng: 'ur',
      ns: ['common'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false, // React already escapes
      },
      detection: {
        // Only used as fallback — we control locale via context
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'md-locale',
        caches: ['localStorage'],
      },
      returnObjects: true,
    })

  return i18n
}

export default i18n
