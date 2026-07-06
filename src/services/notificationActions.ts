import { collection, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'

export async function markAllNotificationsRead(): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  try {
    const snap = await getDocs(query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      where('read', '==', false),
    ))
    if (snap.empty) return
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
    await batch.commit()
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'markAllNotificationsRead' })
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true })
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'markNotificationRead' })
  }
}
