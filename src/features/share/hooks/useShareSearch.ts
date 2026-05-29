import { useState, useCallback, useRef } from 'react'
import { searchUsers } from '../services/shareService'
import type { ShareSearchResult } from '../types'

export function useShareSearch(excludeUserId?: string) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ShareSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback((q: string) => {
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (q.length < 1) {
      setResults([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const users = await searchUsers(q, excludeUserId)
      setResults(users as ShareSearchResult[])
      setLoading(false)
    }, 300)
  }, [excludeUserId])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    clearTimeout(debounceRef.current)
  }, [])

  return { query, results, loading, search, clear }
}
