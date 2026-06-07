// src/lib/i18n/LocaleContext.tsx
'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { initI18n, detectLocale, getLocaleDir, type SupportedLocale } from './config'

interface LocaleContextValue {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  dir: 'ltr' | 'rtl'
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'ur',
  setLocale: () => {},
  dir: 'ltr',
})

export function useLocale() {
  return useContext(LocaleContext)
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value};max-age=${days * 86400};path=/`
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const initialLocale: SupportedLocale = typeof window !== 'undefined' ? detectLocale() : 'ur'
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale)
  const [dir, setDir] = useState<'ltr' | 'rtl'>(getLocaleDir(initialLocale))
  const [ready, setReady] = useState(false)

  // Initialize i18n on mount
  useEffect(() => {
    initI18n(locale)
    Promise.resolve().then(() => setReady(true))
  }, [locale])

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    if (typeof window === 'undefined') return
    // Persist
    localStorage.setItem('md-locale', newLocale)
    setCookie('md-locale', newLocale)

    // Update i18next
    const i18n = initI18n(newLocale)
    i18n.changeLanguage(newLocale)

    // Update state
    setLocaleState(newLocale)
    setDir(getLocaleDir(newLocale))

    // Set <html> attributes
    document.documentElement.lang = newLocale
    document.documentElement.dir = getLocaleDir(newLocale)

    // Toggle font class
    document.documentElement.classList.remove('locale-en', 'locale-ur')
    document.documentElement.classList.add(`locale-${newLocale}`)
  }, [])

  // Sync html attributes on mount
  useEffect(() => {
    if (!ready) return
    document.documentElement.lang = locale
    document.documentElement.dir = dir
    document.documentElement.classList.add(`locale-${locale}`)
  }, [ready, locale, dir])

  if (!ready) {
    return <>{children}</> // avoid flash
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, dir }}>
      {children}
    </LocaleContext.Provider>
  )
}

export default LocaleContext
