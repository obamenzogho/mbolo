import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '../../../../lib/firebase'
import type { Comment } from '../../../../types'

const commentsCol = (videoId: string) => collection(db, 'videos', videoId, 'comments')

export function subscribeComments(videoId: string, cb: (c: Comment[]) => void): Unsubscribe {
  const q = query(commentsCol(videoId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) }))),
  )
}

export async function addComment(videoId: string, userId: string, text: string) {
  return addDoc(commentsCol(videoId), {
    userId, text: text.trim(), createdAt: serverTimestamp(),
    likes: 0, likedBy: [], replyCount: 0,
  })
}

export async function removeComment(videoId: string, commentId: string) {
  return deleteDoc(doc(db, 'videos', videoId, 'comments', commentId))
}
