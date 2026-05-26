import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { translations, Language, TranslationKeys, getTranslation } from './translations'

const LANGUAGE_KEY = '@mbolo_language'

interface I18nContextType {
  t: TranslationKeys
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  availableLanguages: { code: Language; label: string }[]
}

const defaultContext: I18nContextType = {
  t: getTranslation('fr'),
  language: 'fr',
  setLanguage: async () => {},
  availableLanguages: [
    { code: 'fr', label: 'Français' },
    { code: 'fang', label: 'Fang' },
    { code: 'punu', label: 'Punu' },
    { code: 'nzebi', label: 'Nzebi' },
  ],
}

const I18nContext = createContext<I18nContextType>(defaultContext)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr')

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (saved && (saved in translations)) {
        setLanguageState(saved as Language)
      }
    }).catch(() => {})
  }, [])

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang)
      setLanguageState(lang)
    } catch {}
  }

  const t = getTranslation(language)

  return (
    <I18nContext.Provider value={{ t, language, setLanguage, availableLanguages: defaultContext.availableLanguages }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export { getTranslation }
export type { Language, TranslationKeys }
