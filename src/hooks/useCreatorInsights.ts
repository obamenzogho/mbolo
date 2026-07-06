import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

export interface CreatorInsights {
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  videoCount: number
  topVideos: { id: string; thumbnailURL?: string; views: number; likes: number }[]
}

export function useCreatorInsights(userId: string) {
  const [insights, setInsights] = useState<CreatorInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      setLoading(true)
      try {
        const q = query(
          collection(db, 'videos'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(200),
        )
        const snap = await getDocs(q)
        let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0
        const vids = snap.docs.map((d) => {
          const v: any = d.data()
          totalViews += v.views ?? 0
          totalLikes += v.likes ?? 0
          totalComments += v.comments ?? 0
          totalShares += v.shares ?? 0
          return { id: d.id, thumbnailURL: v.thumbnailURL, views: v.views ?? 0, likes: v.likes ?? 0 }
        })
        const topVideos = [...vids].sort((a, b) => b.views - a.views).slice(0, 5)
        setInsights({
          totalViews, totalLikes, totalComments, totalShares,
          videoCount: vids.length, topVideos,
        })
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'creatorInsights' })
      }
      setLoading(false)
    })()
  }, [userId])

  return { insights, loading }
}
