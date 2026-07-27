import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { DEFAULT_SETTINGS, mergeSettings, type MboloSettings } from '../types'

/**
 * Service central des réglages MBolo.
 *
 * Source de vérité : `users/{uid}/settings/preferences` (sous-collection privée,
 * owner-only). Cache miroir local dans AsyncStorage pour un premier rendu
 * instantané et un fonctionnement hors-ligne. La synchro multi-appareils repose
 * sur onSnapshot (même pattern que FollowContext).
 */

const CACHE_KEY = '@mbolo_settings_v1'
const SETTINGS_DOC = 'preferences'

// Anciens emplacements, absorbés à la première migration.
const LEGACY_DATASAVER_KEY = '@mbolo_dataSaver'
const LEGACY_LANGUAGE_KEY = '@mbolo_language'

function settingsRef(uid: string) {
  return doc(db, 'users', uid, 'settings', SETTINGS_DOC)
}

/** Lit le cache local (affichage immédiat avant le 1er snapshot réseau). */
export async function readCachedSettings(): Promise<MboloSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return mergeSettings(JSON.parse(raw))
  } catch {
    return null
  }
}

async function writeCache(settings: MboloSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(settings))
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'settings:writeCache' })
  }
}

/**
 * S'abonne au doc de réglages en temps réel. Renvoie la fonction de
 * désabonnement. Chaque snapshot met aussi le cache local à jour.
 */
export function subscribeSettings(
  uid: string,
  cb: (settings: MboloSettings) => void,
): () => void {
  return onSnapshot(
    settingsRef(uid),
    (snap: any) => {
      const merged = mergeSettings(snap.exists() ? snap.data() : null)
      writeCache(merged)
      cb(merged)
    },
    (error: any) => {
      captureException(error, { context: 'settings:subscribe' })
    },
  )
}

/**
 * Met à jour un sous-ensemble de réglages via un chemin par points
 * (ex. 'privacy.privateAccount'). Écrit en merge → n'écrase rien d'autre.
 * Retourne l'objet fusionné localement pour une MAJ optimiste immédiate.
 */
export async function updateSetting(
  uid: string,
  path: string,
  value: unknown,
  current: MboloSettings,
): Promise<MboloSettings> {
  const [group, key] = path.split('.')
  const optimistic: MboloSettings = key
    ? { ...current, [group]: { ...(current as any)[group], [key]: value } }
    : { ...current, [group]: value } as MboloSettings

  await writeCache(optimistic)

  try {
    // setDoc merge crée le doc au besoin et ne touche que le champ ciblé.
    const patch: any = key ? { [group]: { [key]: value } } : { [group]: value }
    patch._updatedAt = Date.now()
    await setDoc(settingsRef(uid), { ...patch, _serverUpdatedAt: serverTimestamp() }, { merge: true })
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'settings:update', path })
    throw e
  }

  return optimistic
}

/**
 * Migration one-shot : importe les anciens réglages éparpillés (doc user public
 * + AsyncStorage legacy) vers la sous-collection privée, une seule fois.
 * Idempotent : le flag _migratedFromUserDoc empêche toute réexécution.
 */
export async function migrateLegacySettings(uid: string): Promise<void> {
  try {
    const ref = settingsRef(uid)
    const snap = await getDoc(ref)
    if (snap.exists() && snap.data()?._migratedFromUserDoc) return

    const patch: any = { _migratedFromUserDoc: true, _updatedAt: Date.now() }

    // 1) Champs privés stockés à tort dans le doc user public.
    try {
      const userSnap = await getDoc(doc(db, 'users', uid))
      if (userSnap.exists()) {
        const u = userSnap.data() as any
        if (typeof u.privateAccount === 'boolean') {
          patch.privacy = { ...(patch.privacy || {}), privateAccount: u.privateAccount }
        }
        if (typeof u.showAge === 'boolean') {
          patch.privacy = { ...(patch.privacy || {}), showAge: u.showAge }
        }
        if (typeof u.notifications === 'boolean') {
          patch.notifications = { ...(patch.notifications || {}), enabled: u.notifications }
        }
        if (u.accountType) {
          patch.account = { ...(patch.account || {}), accountType: u.accountType }
        }
      }
    } catch { /* doc user illisible : on continue avec les defaults */ }

    // 2) Réglages locaux (AsyncStorage) déjà utilisés par l'app.
    try {
      const [ds, lang] = await Promise.all([
        AsyncStorage.getItem(LEGACY_DATASAVER_KEY),
        AsyncStorage.getItem(LEGACY_LANGUAGE_KEY),
      ])
      if (ds === 'true') {
        patch.preferences = { ...(patch.preferences || {}), dataSaver: true }
      }
      if (lang) {
        patch.account = { ...(patch.account || {}), language: lang }
      }
    } catch { /* ignore */ }

    await setDoc(ref, patch, { merge: true })
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'settings:migrate' })
  }
}

export { DEFAULT_SETTINGS }
