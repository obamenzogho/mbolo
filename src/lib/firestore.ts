import { collection, query, where, limit as firestoreLimit, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { captureException } from './sentry'
import type { User } from '../types'

const BATCH_SIZE = 30

export interface AuthorInfo {
  name: string
  photo: string | null
}

export async function batchFetchUsers(ids: string[]): Promise<Map<string, User>> {
  const result = new Map<string, User>()
  if (ids.length === 0) return result

  const uniqueIds = [...new Set(ids)]

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE)
    try {
      const q = query(collection(db, 'users'), where('__name__', 'in', chunk), firestoreLimit(BATCH_SIZE))
      const snap = await getDocs(q)
      snap.docs.forEach((d: any) => {
        result.set(d.id, { id: d.id, ...d.data() } as User)
      })
    } catch (batchErr) {
      captureException(batchErr instanceof Error ? batchErr : new Error(String(batchErr)), { context: 'batchFetchUsers-batch' })
      for (const id of chunk) {
        try {
          const { getDoc, doc } = await import('firebase/firestore')
          const snap = await getDoc(doc(db, 'users', id))
          if (snap.exists()) {
            result.set(snap.id, { id: snap.id, ...snap.data() } as User)
          }
        } catch (singleErr) {
          captureException(singleErr instanceof Error ? singleErr : new Error(String(singleErr)), { context: 'batchFetchUsers-single', userId: id })
        }
      }
    }
  }

  return result
}

export async function batchFetchAuthors(ids: string[]): Promise<Map<string, AuthorInfo>> {
  const result = new Map<string, AuthorInfo>()
  if (ids.length === 0) return result

  const uniqueIds = [...new Set(ids)]

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE)
    try {
      const q = query(collection(db, 'users'), where('__name__', 'in', chunk), firestoreLimit(BATCH_SIZE))
      const snap = await getDocs(q)
      snap.docs.forEach((d: any) => {
        const data = d.data()
        result.set(d.id, { name: data.nom || data.pseudo || 'Utilisateur', photo: data.photoURL || null })
      })
    } catch (batchErr) {
      captureException(batchErr instanceof Error ? batchErr : new Error(String(batchErr)), { context: 'batchFetchAuthors-batch' })
      for (const id of chunk) {
        try {
          const { getDoc, doc } = await import('firebase/firestore')
          const snap = await getDoc(doc(db, 'users', id))
          if (snap.exists()) {
            const data = snap.data()
            result.set(snap.id, { name: data.nom || data.pseudo || 'Utilisateur', photo: data.photoURL || null })
          }
        } catch (singleErr) {
          captureException(singleErr instanceof Error ? singleErr : new Error(String(singleErr)), { context: 'batchFetchAuthors-single', userId: id })
        }
      }
    }
  }

  return result
}
