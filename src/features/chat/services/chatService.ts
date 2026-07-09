import {
  doc, getDoc, setDoc, addDoc, collection, deleteDoc,
  serverTimestamp, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import type { Conversation } from '@/types'

function createConversationId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort()
  return `${sorted[0]}_${sorted[1]}`
}

export async function getOrCreateConversation(
  userId1: string,
  userId2: string,
  markAsSpamForRecipient?: boolean,
) {
  const convId = createConversationId(userId1, userId2)
  const ref = doc(db, 'conversations', convId)
  try {
    const snap = await getDoc(ref)
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Conversation
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getOrCreateConv_getDoc', convId })
    throw e
  }

  const data: Record<string, any> = {
    participants: [userId1, userId2],
    updatedAt: serverTimestamp(),
    lastReadAt: {
      [userId1]: serverTimestamp(),
      [userId2]: serverTimestamp(),
    },
  }
  if (markAsSpamForRecipient) {
    data.spamFor = [userId2]
  }
  try {
    await setDoc(ref, data)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getOrCreateConv_setDoc', convId })
    throw e
  }
  return { id: convId, ...data } as Conversation
}

export async function acceptConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    spamFor: arrayRemove(userId),
  })
}

export async function blockConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    blockedBy: arrayUnion(userId),
  })
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  extra?: { type?: string; storyRef?: { storyId: string; mediaUrl: string; mediaType: string; ownerId: string } },
) {
  const msgData: Record<string, any> = {
    senderId,
    text,
    type: extra?.type ?? 'text',
    createdAt: serverTimestamp(),
    storyRef: extra?.storyRef ?? null,
  }

  const msgRef = await addDoc(
    collection(db, 'conversations', conversationId, 'messages'),
    msgData,
  )

  const convRef = doc(db, 'conversations', conversationId)
  await updateDoc(convRef, {
    lastMessage: {
      text,
      senderId,
      createdAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  })

  return msgRef.id
}

export async function markConversationAsRead(
  conversationId: string,
  userId: string,
) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    [`lastReadAt.${userId}`]: serverTimestamp(),
  })
}

export async function markConversationAsUnread(
  conversationId: string,
  userId: string,
) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    [`lastReadAt.${userId}`]: null,
  })
}

export async function pinConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    pinnedBy: arrayUnion(userId),
  })
}

export async function unpinConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    pinnedBy: arrayRemove(userId),
  })
}

export async function muteConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    mutedBy: arrayUnion(userId),
  })
}

export async function unmuteConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    mutedBy: arrayRemove(userId),
  })
}

export async function deleteConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    deletedBy: arrayUnion(userId),
  })
}

export async function unarchiveConversation(conversationId: string, userId: string) {
  const ref = doc(db, 'conversations', conversationId)
  await updateDoc(ref, {
    deletedBy: arrayRemove(userId),
  })
}

export async function deleteMessage(conversationId: string, messageId: string) {
  const ref = doc(db, 'conversations', conversationId, 'messages', messageId)
  await deleteDoc(ref)
}
