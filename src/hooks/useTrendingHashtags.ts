import { useState, useEffect, useCallback } from 'react'
import { getTrendingHashtags, type TrendingHashtag } from '../services/hashtagService'

export function useTrendingHashtags(max = 10) {
  const [tags, setTags] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getTrendingHashtags(max)
    setTags(data)
    setLoading(false)
  }, [max])

  useEffect(() => {
    load()
  }, [load])

  return { tags, loading, refresh: load }
}
