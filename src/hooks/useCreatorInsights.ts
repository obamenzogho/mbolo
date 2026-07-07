import { useEffect, useState } from 'react'
import {
  doc, onSnapshot, collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { captureException } from '../lib/sentry'

export interface TopVideo {
  id: string
  description: string
  thumbnailURL?: string
  views: number
  likes: number
}

export interface CreatorInsights {
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  postsCount: number
  topVideos: TopVideo[]
}

export function useCreatorInsights(uid: string) {
  const [insights, setInsights] = useState<CreatorInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      async (snap) => {
        if (!snap.exists()) { setLoading(false); return }
        const d = snap.data()

        let topVideos: TopVideo[] = []
        try {
          const vidsSnap = await getDocs(query(
            collection(db, 'videos'),
            where('userId', '==', uid),
            orderBy('views', 'desc'),
            limit(5),
          ))
          topVideos = vidsSnap.docs.map((v) => {
            const vd = v.data()
            return {
              id: v.id,
              description: vd.description ?? '',
              thumbnailURL: vd.thumbnailURL ?? vd.coverURL ?? '',
              views: vd.views ?? 0,
              likes: vd.likes ?? 0,
            }
          })
        } catch (e) {
          captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useCreatorInsights topVideos' })
        }

        setInsights({
          totalViews: d.totalViews ?? 0,
          totalLikes: d.totalLikes ?? 0,
          totalComments: d.totalComments ?? 0,
          totalShares: d.totalShares ?? 0,
          postsCount: d.postsCount ?? 0,
          topVideos,
        })
        setLoading(false)
      },
      (error) => {
        captureException(error, { context: 'useCreatorInsights onSnapshot' })
        setLoading(false)
      },
    )

    return unsub
  }, [uid])

  return { insights, loading }
}
