import { captureException } from '../lib/sentry'

const KLIPY_API_KEY = process.env.EXPO_PUBLIC_KLIPY_API_KEY || 'YOUR_KLIPY_API_KEY'
const BASE_URL = 'https://api.klipy.co/api/v1'

export interface KlipyGifResult {
  id: string
  title?: string
  url?: string
  description?: string
  files?: {
    gif?: { url: string; size: number; width: number; height: number }
    tinygif?: { url: string; size: number; width: number; height: number }
    mediumgif?: { url: string; size: number; width: number; height: number }
    webp?: { url: string; size: number; width: number; height: number }
    tinywebp?: { url: string; size: number; width: number; height: number }
    mp4?: { url: string; size: number; width: number; height: number }
  }
  tags?: string[]
  created_at?: string
}

const getHeaders = () => ({
  'Accept': 'application/json',
  'Authorization': `Bearer ${KLIPY_API_KEY}`,
})

const makeUrl = (endpoint: string, params: Record<string, string | number> = {}) => {
  const query = new URLSearchParams({
    ...params,
    api_key: KLIPY_API_KEY,
  }).toString()
  return `${BASE_URL}/${endpoint}?${query}`
}

export const gifService = {
  getTrending: async (limit = 20): Promise<KlipyGifResult[]> => {
    try {
      const res = await fetch(makeUrl('gifs/trending', { limit }), { headers: getHeaders() })
      if (!res.ok) console.warn(`Klipy trending: HTTP ${res.status}`)
      const data = await res.json()
      const results = data?.data || data?.results || data?.gifs || data || []
      return Array.isArray(results) ? results : []
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'gifTrending' })
      console.error('gifService trending error:', e)
      return []
    }
  },

  search: async (query: string, limit = 20): Promise<KlipyGifResult[]> => {
    try {
      const res = await fetch(makeUrl('gifs/search', { q: query, limit }), { headers: getHeaders() })
      if (!res.ok) console.warn(`Klipy search: HTTP ${res.status}`)
      const data = await res.json()
      const results = data?.data || data?.results || data?.gifs || data || []
      return Array.isArray(results) ? results : []
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'gifSearch' })
      console.error('gifService search error:', e)
      return []
    }
  },

  getTrendingStickers: async (limit = 20): Promise<KlipyGifResult[]> => {
    try {
      const res = await fetch(makeUrl('stickers/trending', { limit }), { headers: getHeaders() })
      if (!res.ok) console.warn(`Klipy stickers: HTTP ${res.status}`)
      const data = await res.json()
      const results = data?.data || data?.results || data?.stickers || data || []
      return Array.isArray(results) ? results : []
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'gifStickersTrending' })
      console.error('gifService stickers trending error:', e)
      return []
    }
  },

  searchStickers: async (query: string, limit = 20): Promise<KlipyGifResult[]> => {
    try {
      const res = await fetch(makeUrl('stickers/search', { q: query, limit }), { headers: getHeaders() })
      if (!res.ok) console.warn(`Klipy stickers search: HTTP ${res.status}`)
      const data = await res.json()
      const results = data?.data || data?.results || data?.stickers || data || []
      return Array.isArray(results) ? results : []
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'gifStickersSearch' })
      console.error('gifService stickers search error:', e)
      return []
    }
  },

  getAfricanGifs: async (): Promise<KlipyGifResult[]> => {
    return gifService.search('african gabon celebration dance', 20)
  },

  getGifUrl: (result: KlipyGifResult): string => {
    return result?.files?.gif?.url
      || result?.files?.mediumgif?.url
      || result?.files?.tinygif?.url
      || result?.url
      || ''
  },

  getThumbnailUrl: (result: KlipyGifResult): string => {
    return result?.files?.tinygif?.url
      || result?.files?.gif?.url
      || result?.url
      || ''
  },

  getGifDimensions: (result: KlipyGifResult): { width: number; height: number } => {
    const gif = result?.files?.gif
    if (gif?.width && gif?.height) return { width: gif.width, height: gif.height }
    const tiny = result?.files?.tinygif
    if (tiny?.width && tiny?.height) return { width: tiny.width, height: tiny.height }
    return { width: 200, height: 200 }
  },
}

export default gifService