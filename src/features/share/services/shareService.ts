import {
  collection, addDoc, getDocs, query, where, orderBy, limit,
  doc, updateDoc, increment, serverTimestamp, Timestamp,
  getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { getOrCreateConversation, sendMessage } from '@/features/chat/services/chatService'
import type { Share, ShareType } from '../types'

export async function createShare({
  senderId,
  receiverId,
  groupId,
  postId,
  shareType,
  videoURL,
  description,
}: {
  senderId: string
  receiverId?: string
  groupId?: string
  postId: string
  shareType: ShareType
  videoURL?: string
  description?: string
}): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'shares'), {
      senderId,
      receiverId: receiverId || null,
      groupId: groupId || null,
      postId,
      shareType,
      createdAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'videos', postId), { shares: increment(1) })
    return ref.id
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'createShare' })
    throw e
  }
}

export async function shareToDM(
  senderId: string,
  receiverId: string,
  postId: string,
  videoURL?: string,
  description?: string,
): Promise<void> {
  const conv = await getOrCreateConversation(senderId, receiverId)
  const shareMsg = description
    ? `🎬 ${description.substring(0, 100)}`
    : `🎬 Vidéo partagée`
  const link = videoURL ? `\n${videoURL}` : ''
  await sendMessage(conv.id, senderId, `${shareMsg}${link}`)
  await createShare({ senderId, receiverId, postId, shareType: 'DM_SHARE' })

  try {
    const videoSnap = await getDoc(doc(db, 'videos', postId))
    if (videoSnap.exists()) {
      const videoOwnerId = videoSnap.data().userId
      if (videoOwnerId && videoOwnerId !== senderId) {
        await addDoc(collection(db, 'notifications'), {
          userId: videoOwnerId,
          type: 'share',
          fromUserId: senderId,
          videoId: postId,
          read: false,
          createdAt: serverTimestamp(),
        })
      }
    }
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'shareToDM_notification' })
  }
}

export async function getSharesForVideo(
  postId: string,
  max: number = 50,
): Promise<Share[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'shares'),
        where('postId', '==', postId),
        orderBy('createdAt', 'desc'),
        limit(max),
      ),
    )
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        senderId: data.senderId,
        receiverId: data.receiverId ?? undefined,
        groupId: data.groupId ?? undefined,
        postId: data.postId,
        shareType: data.shareType,
        createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
      } as Share
    })
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getSharesForVideo' })
    return []
  }
}

export async function searchUsers(
  queryText: string,
  excludeUserId?: string,
  max: number = 20,
): Promise<{ id: string; pseudo: string; nom?: string; photoURL?: string }[]> {
  if (queryText.length < 1) return []
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users'),
        where('pseudo', '>=', queryText),
        where('pseudo', '<=', queryText + '\uf8ff'),
        limit(max),
      ),
    )
    return snap.docs
      .map((d) => {
        const data = d.data()
        return { id: d.id, pseudo: data.pseudo, nom: data.nom, photoURL: data.photoURL }
      })
      .filter((u) => u.id !== excludeUserId)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'searchUsers' })
    return []
  }
}
