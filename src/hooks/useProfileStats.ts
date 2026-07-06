import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProfileStats {
  postsCount: number
  followerCount: number
  followingCount: number
  totalLikes: number
}

export function useProfileStats(userId: string) {
  const [stats, setStats] = useState<ProfileStats>({
    postsCount: 0, followerCount: 0, followingCount: 0, totalLikes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(doc(db, 'users', userId), (snap: any) => {
      if (snap.exists()) {
        const d = snap.data()
        setStats({
          postsCount: d.postsCount ?? 0,
          followerCount: d.followerCount ?? d.followers?.length ?? 0,
          followingCount: d.followingCount ?? d.following?.length ?? 0,
          totalLikes: d.totalLikes ?? 0,
        })
      }
      setLoading(false)
    })
    return unsub
  }, [userId])

  return { stats, loading }
}
