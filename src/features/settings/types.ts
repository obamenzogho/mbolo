/**
 * Modèle unifié des réglages Paramètres & confidentialité de MBolo.
 *
 * Stocké dans la sous-collection PRIVÉE `users/{uid}/settings/preferences`
 * (règles owner-only), jamais dans le doc user public. Synchronisé entre
 * appareils via onSnapshot et mis en cache localement (AsyncStorage) pour un
 * affichage immédiat au démarrage / hors-ligne.
 *
 * Toute nouvelle clé DOIT recevoir une valeur par défaut dans DEFAULT_SETTINGS.
 */

export type ThemeMode = 'dark' | 'light' | 'system'
export type TextSize = 'small' | 'default' | 'large' | 'xlarge'
export type Audience = 'everyone' | 'followers' | 'nobody'
export type VideoQuality = 'auto' | 'high' | 'data-saver'

export interface MboloSettings {
  // ── Compte ──────────────────────────────────────────────
  account: {
    language: string // code i18n : 'fr' | 'en' | 'es' | 'fang'
    accountType: 'personal' | 'creator' | 'business'
  }

  // ── Confidentialité ─────────────────────────────────────
  privacy: {
    privateAccount: boolean
    whoCanComment: Audience
    whoCanMention: Audience
    whoCanRepost: Audience
    whoCanMessage: Audience
    storyAudience: Audience
    storyExcludedUsers: string[]
    showActivityStatus: boolean
    showAge: boolean
  }

  // ── Notifications (push par catégorie) ──────────────────
  notifications: {
    enabled: boolean // interrupteur maître
    likes: boolean
    comments: boolean
    follows: boolean
    mentions: boolean
    messages: boolean
    reposts: boolean
    fromMbolo: boolean // annonces produit
  }

  // ── Sécurité ────────────────────────────────────────────
  security: {
    loginAlerts: boolean
    twoFactorEnabled: boolean
  }

  // ── Préférences ─────────────────────────────────────────
  preferences: {
    theme: ThemeMode
    autoplay: boolean
    videoQuality: VideoQuality
    dataSaver: boolean
    hapticsEnabled: boolean
  }

  // ── Accessibilité ───────────────────────────────────────
  accessibility: {
    reduceMotion: boolean
    textSize: TextSize
    highContrast: boolean
    autoCaptions: boolean
  }

  // ── Temps d'utilisation ─────────────────────────────────
  screenTime: {
    dailyReminderEnabled: boolean
    dailyLimitMinutes: number // 0 = pas de limite
    breakRemindersEnabled: boolean
    breakIntervalMinutes: number
  }

  // Métadonnées internes
  _migratedFromUserDoc?: boolean
  _updatedAt?: number
}

export const DEFAULT_SETTINGS: MboloSettings = {
  account: {
    language: 'fr',
    accountType: 'personal',
  },
  privacy: {
    privateAccount: false,
    whoCanComment: 'everyone',
    whoCanMention: 'everyone',
    whoCanRepost: 'everyone',
    whoCanMessage: 'everyone',
    storyAudience: 'everyone',
    storyExcludedUsers: [],
    showActivityStatus: true,
    showAge: false,
  },
  notifications: {
    enabled: true,
    likes: true,
    comments: true,
    follows: true,
    mentions: true,
    messages: true,
    reposts: true,
    fromMbolo: true,
  },
  security: {
    loginAlerts: true,
    twoFactorEnabled: false,
  },
  preferences: {
    theme: 'dark',
    autoplay: true,
    videoQuality: 'auto',
    dataSaver: false,
    hapticsEnabled: true,
  },
  accessibility: {
    reduceMotion: false,
    textSize: 'default',
    highContrast: false,
    autoCaptions: false,
  },
  screenTime: {
    dailyReminderEnabled: false,
    dailyLimitMinutes: 0,
    breakRemindersEnabled: false,
    breakIntervalMinutes: 60,
  },
}

/** Fusion profonde (2 niveaux) d'un patch partiel avec les valeurs par défaut. */
export function mergeSettings(partial: DeepPartial<MboloSettings> | null | undefined): MboloSettings {
  if (!partial) return structuredCloneSafe(DEFAULT_SETTINGS)
  const base = structuredCloneSafe(DEFAULT_SETTINGS)
  const out = { ...base } as MboloSettings
  ;(Object.keys(base) as (keyof MboloSettings)[]).forEach((k) => {
    const dv = base[k]
    const pv = (partial as any)[k]
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      ;(out as any)[k] = { ...(dv as any), ...(pv || {}) }
    } else if (pv !== undefined) {
      ;(out as any)[k] = pv
    }
  })
  return out
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/** structuredClone n'est pas garanti sur Hermes → fallback JSON. */
function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
