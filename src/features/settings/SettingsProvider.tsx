import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { auth } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { useDataSaver } from '@/contexts/DataSaverContext'
import { useI18n } from '@/i18n/index'
import { DEFAULT_SETTINGS, mergeSettings, type MboloSettings } from './types'
import {
  subscribeSettings,
  updateSetting as updateSettingRemote,
  readCachedSettings,
  migrateLegacySettings,
} from './services/settingsService'
import { useAppliedAccessibility } from './appliedStore'

interface SettingsContextValue {
  settings: MboloSettings
  loading: boolean
  /** Met à jour un réglage par chemin ('privacy.privateAccount'). Optimiste + persistant. */
  update: (path: string, value: unknown) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  update: async () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MboloSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const uidRef = useRef<string | null>(null)

  // Contextes runtime existants : le SettingsProvider les pilote pour appliquer
  // les réglages synchronisés depuis un autre appareil (source = Firestore).
  const { isEnabled: dataSaverOn, toggle: toggleDataSaver } = useDataSaver()
  const { language, setLanguage } = useI18n()

  // 1) Hydratation immédiate depuis le cache local (avant le réseau).
  useEffect(() => {
    let cancelled = false
    readCachedSettings().then((cached) => {
      if (cancelled || !cached) return
      setSettings(cached)
    })
    return () => { cancelled = true }
  }, [])

  // 2) Abonnement temps réel lié à la session.
  useEffect(() => {
    let unsub: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, (fbUser: any) => {
      if (unsub) { unsub(); unsub = null }

      if (!fbUser) {
        uidRef.current = null
        setSettings(mergeSettings(null))
        setLoading(false)
        return
      }

      const uid = fbUser.uid
      uidRef.current = uid
      setLoading(true)

      // Migration one-shot (idempotente) puis abonnement.
      migrateLegacySettings(uid).finally(() => {
        unsub = subscribeSettings(uid, (next) => {
          setSettings(next)
          setLoading(false)
        })
      })
    })

    return () => {
      if (unsub) unsub()
      unsubAuth()
    }
  }, [])

  // 3) Application des réglages synchronisés aux contextes runtime.
  //    Flux unidirectionnel : le doc Firestore décide, on aligne le runtime.
  useEffect(() => {
    if (loading) return
    if (settings.preferences.dataSaver !== dataSaverOn) {
      toggleDataSaver()
    }
  }, [settings.preferences.dataSaver, dataSaverOn, loading, toggleDataSaver])

  useEffect(() => {
    if (loading) return
    if (settings.account.language && settings.account.language !== language) {
      setLanguage(settings.account.language as any)
    }
  }, [settings.account.language, language, loading, setLanguage])

  // Réglages d'accessibilité appliqués au runtime (animations, taille texte,
  // contraste, haptics) via un store léger lu par les primitives (usePageAnimation,
  // useHaptics, etc.).
  useEffect(() => {
    useAppliedAccessibility.getState().setFromSettings({
      reduceMotion: settings.accessibility.reduceMotion,
      textSize: settings.accessibility.textSize,
      highContrast: settings.accessibility.highContrast,
      hapticsEnabled: settings.preferences.hapticsEnabled,
    })
  }, [
    settings.accessibility.reduceMotion,
    settings.accessibility.textSize,
    settings.accessibility.highContrast,
    settings.preferences.hapticsEnabled,
  ])

  // Sync privacy fields to the public user doc (for client-side story filtering).
  // `privateAccount` and `storyExcludedUsers` are read by other clients to decide
  // whether to show this user's stories.
  useEffect(() => {
    const uid = uidRef.current
    if (!uid || loading) return
    updateDoc(doc(db, 'users', uid), {
      privateAccount: settings.privacy.privateAccount,
      storyExcludedUsers: settings.privacy.storyExcludedUsers,
    }).catch(() => {})
  }, [settings.privacy.privateAccount, settings.privacy.storyExcludedUsers, loading])

  const update = useCallback(async (path: string, value: unknown) => {
    const uid = uidRef.current
    // MAJ optimiste locale immédiate même sans réseau/session.
    setSettings((cur) => {
      const [group, key] = path.split('.')
      return key
        ? { ...cur, [group]: { ...(cur as any)[group], [key]: value } }
        : ({ ...cur, [group]: value } as MboloSettings)
    })
    if (!uid) return
    try {
      await updateSettingRemote(uid, path, value, settings)
    } catch {
      // L'erreur est déjà capturée par le service ; le snapshot rétablira l'état réel.
    }
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings, loading, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
