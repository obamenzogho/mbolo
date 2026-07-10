import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { notifyPostOwner } from '../services/newsNotifications'
import type { NewsComment } from '../types'

const COMMENTS_LIMIT = 100

function toDate(value: any): Date {
  if (!value) return new Date()
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  return new Date(value)
}

export function useNewsComments(postId: string | null, postOwnerId?: string) {
  const uid = auth.currentUser?.uid ?? ''
  const [comments, setComments] = useState<NewsComment[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!postId) {
      setComments([])
      return
    }

    setLoading(true)

    return onSnapshot(
      query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'asc'),
        limit(COMMENTS_LIMIT),
      ),
      (snapshot: any) => {
        setComments(
          snapshot.docs.map((commentDoc: any) => {
            const data = commentDoc.data()

            return {
              id: commentDoc.id,
              postId,
              userId: data.userId,
              userName: data.userName || 'Utilisateur',
              userPhotoURL: data.userPhotoURL || undefined,
              text: data.text || '',
              likes: data.likes ?? 0,
              likedBy: Array.isArray(data.likedBy)
                ? data.likedBy
                : [],
              createdAt: toDate(data.createdAt),
            }
          }),
        )

        setLoading(false)
      },
      (error: any) => {
        captureException(
          error instanceof Error
            ? error
            : new Error(String(error)),
          { context: 'useNewsComments.snapshot', postId },
        )
        setLoading(false)
      },
    )
  }, [postId])

  const addComment = useCallback(async (text: string) => {
    const cleanText = text.trim()
    const user = auth.currentUser

    if (!postId || !user || !cleanText) return false

    try {
      const profileSnapshot = await getDoc(
        doc(db, 'users', user.uid),
      )
      const profile = profileSnapshot.data()

      await addDoc(collection(db, 'posts', postId, 'comments'), {
        postId,
        userId: user.uid,
        userName:
          profile?.nom ||
          profile?.pseudo ||
          user.displayName ||
          'Utilisateur',
        userPhotoURL:
          profile?.photoURL ||
          user.photoURL ||
          null,
        text: cleanText,
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'posts', postId), {
        comments: increment(1),
      })

      if (postOwnerId) {
        notifyPostOwner({
          postOwnerId,
          postId,
          type: 'post_comment',
          text: cleanText.slice(0, 120),
        })
      }

      return true
    } catch (error) {
      captureException(
        error instanceof Error
          ? error
          : new Error(String(error)),
        { context: 'useNewsComments.add', postId },
      )
      return false
    }
  }, [postId, postOwnerId])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!postId || !uid) return false

    try {
      const commentRef = doc(
        db,
        'posts',
        postId,
        'comments',
        commentId,
      )

      const commentSnapshot = await getDoc(commentRef)

      if (
        !commentSnapshot.exists() ||
        commentSnapshot.data().userId !== uid
      ) {
        return false
      }

      await deleteDoc(commentRef)

      await updateDoc(doc(db, 'posts', postId), {
        comments: increment(-1),
      })

      return true
    } catch (error) {
      return false
    }
  }, [postId, uid])

  const toggleLikeComment = useCallback(async (
    commentId: string,
  ) => {
    if (!postId || !uid) return

    try {
      await runTransaction(db, async (transaction) => {
        const commentRef = doc(
          db,
          'posts',
          postId,
          'comments',
          commentId,
        )
        const snapshot = await transaction.get(commentRef)
        if (!snapshot.exists()) return

        const data = snapshot.data()
        const likedBy: string[] = Array.isArray(data.likedBy)
          ? data.likedBy
          : []
        const liked = likedBy.includes(uid)

        transaction.update(commentRef, {
          likedBy: liked
            ? arrayRemove(uid)
            : arrayUnion(uid),
          likes: increment(liked ? -1 : 1),
        })
      })
    } catch (error) {
      captureException(
        error instanceof Error
          ? error
          : new Error(String(error)),
        {
          context: 'useNewsComments.toggleLike',
          postId,
          commentId,
        },
      )
    }
  }, [postId, uid])

  return {
    comments,
    loading,
    addComment,
    deleteComment,
    toggleLikeComment,
  }
}
