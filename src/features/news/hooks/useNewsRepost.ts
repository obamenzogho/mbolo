import { useCallback, useState } from 'react'
import { toggleRepost } from '../services/repostMutations'

export function useNewsRepost(
  postId: string,
  initialReposted: boolean,
  initialCount: number,
) {
  const [reposted, setReposted] = useState(initialReposted)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  const toggle = useCallback(async () => {
    if (!postId || loading) return null

    const previousReposted = reposted
    const previousCount = count
    const nextReposted = !previousReposted
    const nextCount = Math.max(
      0,
      previousCount + (nextReposted ? 1 : -1),
    )

    setReposted(nextReposted)
    setCount(nextCount)
    setLoading(true)

    const result = await toggleRepost(postId)

    setLoading(false)

    if (!result) {
      setReposted(previousReposted)
      setCount(previousCount)
      return null
    }

    setReposted(result.reposted)
    setCount(result.reposts)

    return result
  }, [postId, loading, reposted, count])

  return {
    reposted,
    count,
    loading,
    toggle,
  }
}
