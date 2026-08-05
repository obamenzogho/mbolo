import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  runTransaction,
  where,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

export interface SoundRecord {
  id: string
  title: string
  artist: string
  audioURL: string
  durationMs: number
  coverURL?: string
  usageCount: number
  createdAt: number | null
  status: 'active' | 'inactive' | string
}

const SOUNDS_COLLECTION = collection(db, 'sounds')

/** Firestore renvoie un Timestamp ; le SDK admin ou un seed peut renvoyer une Date. */
function toMillis(value: unknown): number | null {
  if (!value) return null
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value as string | number).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

export function mapSoundDocument(
  id: string,
  data: Record<string, unknown>,
): SoundRecord {
  return {
    id,
    title: String(data.title ?? ''),
    artist: String(data.artist ?? ''),
    audioURL: String(data.audioURL ?? ''),
    durationMs: Number(data.durationMs ?? 0),
    coverURL: typeof data.coverURL === 'string' ? data.coverURL : undefined,
    usageCount: Number(data.usageCount ?? 0),
    createdAt: toMillis(data.createdAt),
    status: String(data.status ?? 'inactive'),
  }
}

export async function loadActiveSounds(limitCount = 20): Promise<SoundRecord[]> {
  try {
    const q = query(
      SOUNDS_COLLECTION,
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(limitCount),
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map((docSnapshot: QueryDocumentSnapshot) =>
      mapSoundDocument(docSnapshot.id, docSnapshot.data() as Record<string, unknown>),
    )
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.sound.loadActiveSounds',
    })
    return []
  }
}

export async function loadSoundById(soundId: string): Promise<SoundRecord | null> {
  try {
    const snapshot = await getDoc(doc(SOUNDS_COLLECTION, soundId))
    if (!snapshot.exists()) return null

    return mapSoundDocument(snapshot.id, snapshot.data() as Record<string, unknown>)
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.sound.loadSoundById',
      soundId,
    })
    return null
  }
}

export async function incrementSoundUsage(soundId: string): Promise<boolean> {
  try {
    await runTransaction(db, async (transaction) => {
      const soundRef = doc(SOUNDS_COLLECTION, soundId)
      const snapshot = await transaction.get(soundRef)
      if (!snapshot.exists()) {
        throw new Error('Sound not found')
      }
      transaction.update(soundRef, {
        usageCount: increment(1),
      })
    })
    return true
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.sound.incrementUsage',
      soundId,
    })
    return false
  }
}
