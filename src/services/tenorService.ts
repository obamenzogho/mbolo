const TENOR_API_KEY = process.env.EXPO_PUBLIC_TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURd5MQ'
const BASE_URL = 'https://tenor.googleapis.com/v2'

export interface TenorGifResult {
  id: string
  title: string
  media_formats: {
    gif?: { url: string; dims: [number, number] }
    tinygif?: { url: string; dims: [number, number] }
    nanogif?: { url: string; dims: [number, number] }
    mediumgif?: { url: string; dims: [number, number] }
    tinywebp?: { url: string; dims: [number, number] }
    webp?: { url: string; dims: [number, number] }
    mp4?: { url: string; dims: [number, number] }
    loopedmp4?: { url: string; dims: [number, number] }
    nanowebp?: { url: string; dims: [number, number] }
    webm?: { url: string; dims: [number, number] }
    tinywebm?: { url: string; dims: [number, number] }
    nanomp4?: { url: string; dims: [number, number] }
  }
  created: number
  content_description: string
  itemurl: string
  composite?: Array<{ name: string; val: string }>
}

export const tenorService = {
  getTrending: async (limit = 20): Promise<TenorGifResult[]> => {
    try {
      const res = await fetch(
        `${BASE_URL}/featured?key=${TENOR_API_KEY}&limit=${limit}&locale=fr_FR&contentfilter=medium&media_filter=basic`
      )
      const data = await res.json()
      return data.results || []
    } catch (e) {
      console.error('Tenor trending error:', e)
      return []
    }
  },

  search: async (query: string, limit = 20): Promise<TenorGifResult[]> => {
    try {
      const res = await fetch(
        `${BASE_URL}/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=${limit}&locale=fr_FR&contentfilter=medium&media_filter=basic`
      )
      const data = await res.json()
      return data.results || []
    } catch (e) {
      console.error('Tenor search error:', e)
      return []
    }
  },

  getAfricanGifs: async (): Promise<TenorGifResult[]> => {
    return tenorService.search('african gabon celebration dance', 20)
  },

  getReactionGifs: async (): Promise<TenorGifResult[]> => {
    return tenorService.search('reaction funny', 20)
  },

  getEmojiGifs: async (emoji: string): Promise<TenorGifResult[]> => {
    return tenorService.search(`${emoji} emoji animated`, 10)
  },

  getGifUrl: (result: TenorGifResult, quality: keyof TenorGifResult['media_formats'] = 'mediumgif'): string => {
    return result.media_formats?.[quality]?.url || result.media_formats?.gif?.url || result.media_formats?.tinygif?.url || ''
  },

  getGifDims: (result: TenorGifResult): { width: number; height: number } => {
    const dims = result.media_formats?.gif?.dims || [200, 200]
    return { width: dims[0], height: dims[1] }
  },
}

export default tenorService