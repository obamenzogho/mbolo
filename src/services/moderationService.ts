import {
  doc, collection, addDoc, updateDoc, arrayUnion, arrayRemove,
  serverTimestamp, runTransaction,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { clearBlockedUsersCache } from '../lib/blockService'

export type ReportReason =
  | 'spam' | 'harassment' | 'hate' | 'violence'
  | 'nudity' | 'misinformation' | 'self_harm' | 'other'

export type ReportTarget = 'video' | 'post' | 'comment' | 'user' | 'story'

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam ou arnaque' },
  { key: 'harassment', label: 'Harcèlement ou intimidation' },
  { key: 'hate', label: 'Discours haineux' },
  { key: 'violence', label: 'Violence ou menaces' },
  { key: 'nudity', label: 'Nudité ou contenu sexuel' },
  { key: 'misinformation', label: 'Fausse information' },
  { key: 'self_harm', label: 'Automutilation ou suicide' },
  { key: 'other', label: 'Autre' },
]

export async function reportContent(params: {
  targetType: ReportTarget
  targetId: string
  reason: ReportReason
  contentOwnerId?: string
  details?: string
  commentPath?: string
}): Promise<boolean> {
  const uid = auth.currentUser?.uid
  if (!uid) return false
  try {
    await addDoc(collection(db, 'reports'), {
      reportedBy: uid,
      targetType: params.targetType,
      targetId: params.targetId,
      contentOwnerId: params.contentOwnerId ?? null,
      reason: params.reason,
      details: params.details ?? '',
      commentPath: params.commentPath ?? null,
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    return true
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'reportContent' })
    return false
  }
}

export async function blockUser(targetUid: string): Promise<boolean> {
  const uid = auth.currentUser?.uid
  if (!uid || uid === targetUid) return false
  try {
    await runTransaction(db, async (tx) => {
      const meRef = doc(db, 'users', uid)
      const themRef = doc(db, 'users', targetUid)
      tx.update(meRef, {
        blocked: arrayUnion(targetUid),
        following: arrayRemove(targetUid),
        followers: arrayRemove(targetUid),
      })
      tx.update(themRef, {
        blockedBy: arrayUnion(uid),
        following: arrayRemove(uid),
        followers: arrayRemove(uid),
      })
    })
    clearBlockedUsersCache()
    return true
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'blockUser' })
    return false
  }
}

export async function unblockUser(targetUid: string): Promise<boolean> {
  const uid = auth.currentUser?.uid
  if (!uid) return false
  try {
    await updateDoc(doc(db, 'users', uid), { blocked: arrayRemove(targetUid) })
    await updateDoc(doc(db, 'users', targetUid), { blockedBy: arrayRemove(uid) })
    clearBlockedUsersCache()
    return true
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unblockUser' })
    return false
  }
}
