import { useState, useEffect, useCallback } from 'react'
import { getTrendingHashtags, getTrendingHashtagsByCity, type TrendingHashtag } from '../services/hashtagService'

export function useTrendingHashtags(max = 10, city?: string | null) {
  const [tags, setTags] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = city
      ? await getTrendingHashtagsByCity(city, max)
      : await getTrendingHashtags(max)
    setTags(data)
    setLoading(false)
  }, [max, city])

  useEffect(() => {
    load()
  }, [load])

  return { tags, loading, refresh: load }
}
