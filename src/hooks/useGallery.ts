import { useState, useCallback, useEffect, useRef } from 'react'
import * as MediaLibrary from 'expo-media-library'
import { captureException } from '../lib/sentry'

export interface GalleryAsset {
  id: string
  uri: string
  filename: string
  mediaType: 'photo' | 'video' | 'unknown'
  width: number
  height: number
  creationTime: number
  duration?: number
  modificationTime: number
  localUri?: string
}

export interface GalleryAlbum {
  id: string
  title: string
  assetCount: number
  type: string
}

const MBOLO_ALBUM_NAME = 'Mbolo'

function normalizeMediaType(mediaType: string): GalleryAsset['mediaType'] {
  if (mediaType === 'photo' || mediaType === 'video') return mediaType
  return 'unknown'
}

export const useGallery = () => {
  const [permission, requestPermission] = MediaLibrary.usePermissions()
  const [albums, setAlbums] = useState<GalleryAlbum[]>([])
  const [assets, setAssets] = useState<GalleryAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<GalleryAsset[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const cursorRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)

  const loadAssets = useCallback(async (
    mediaType: 'all' | 'photo' | 'video' = 'all',
    reset = false,
    albumId?: string,
  ) => {
    // Les garde-fous lisent des refs et non l'état : `loadAssets` est appelé
    // depuis `onEndReached`, qui capture une version figée de la closure.
    // Avec l'état, une pagination rapide relit un `hasMore` périmé.
    if (loadingRef.current) return
    if (!reset && !hasMoreRef.current) return
    if (permission?.status !== 'granted') return

    // Un changement de filtre ou d'album repart de zéro : conserver le
    // curseur précédent paginerait dans une autre collection.
    if (reset) {
      cursorRef.current = null
      hasMoreRef.current = true
      setHasMore(true)
      setError(null)
    }

    loadingRef.current = true
    setLoading(true)
    try {
      const options: MediaLibrary.AssetsOptions = {
        first: 30,
        sortBy: [MediaLibrary.SortBy.creationTime],
      }

      if (mediaType === 'photo') {
        options.mediaType = MediaLibrary.MediaType.photo
      } else if (mediaType === 'video') {
        options.mediaType = MediaLibrary.MediaType.video
      } else {
        options.mediaType = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
      }

      if (albumId) {
        options.album = albumId
      }

      if (!reset && cursorRef.current) {
        options.after = cursorRef.current
      }

      const result = await MediaLibrary.getAssetsAsync(options)
      const mappedAssets: GalleryAsset[] = result.assets.map((a) => ({
        id: a.id,
        uri: a.uri,
        filename: a.filename || `media_${a.id}`,
        mediaType: normalizeMediaType(a.mediaType),
        width: a.width || 0,
        height: a.height || 0,
        creationTime: a.creationTime || Date.now(),
        duration: a.duration,
        modificationTime: a.modificationTime || a.creationTime || Date.now(),
      }))

      setAssets(prev => reset ? mappedAssets : [...prev, ...mappedAssets])
      cursorRef.current = result.endCursor
      hasMoreRef.current = result.hasNextPage
      setHasMore(result.hasNextPage)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'loadAssets' })
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [permission])

  const loadAlbums = useCallback(async () => {
    if (permission?.status !== 'granted') return
    try {
      const allAlbums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
      const mapped: GalleryAlbum[] = allAlbums.map((a: any) => ({
        id: a.id,
        title: a.title,
        assetCount: a.assetCount,
        type: a.type,
      }))
      setAlbums(mapped)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'loadAlbums' })
    }
  }, [permission])

  const saveToGallery = useCallback(async (uri: string, filename?: string): Promise<GalleryAsset | null> => {
    if (permission?.status !== 'granted') {
      const res = await requestPermission()
      if (res?.status !== 'granted') return null
    }

    try {
      const asset = await MediaLibrary.createAssetAsync(uri)
      const mapped: GalleryAsset = {
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename || filename || `mbolo_${Date.now()}`,
        mediaType: normalizeMediaType(asset.mediaType),
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
        duration: asset.duration,
        modificationTime: asset.modificationTime,
        localUri: (asset as any).localUri,
      }

      /* Le rangement dans l'album Mbolo est un confort : le média est déjà
         enregistré dans la pellicule, un échec ici ne doit pas le perdre. */
      try {
        const mboloAlbum = await MediaLibrary.getAlbumAsync(MBOLO_ALBUM_NAME)
        if (!mboloAlbum) {
          await MediaLibrary.createAlbumAsync(MBOLO_ALBUM_NAME, asset, false)
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], mboloAlbum, false)
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'mboloAlbum' })
      }

      return mapped
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'saveToGallery' })
      return null
    }
  }, [permission, requestPermission])

  const saveMultipleToGallery = useCallback(async (uris: string[]): Promise<GalleryAsset[]> => {
    const results: GalleryAsset[] = []
    for (const uri of uris) {
      const saved = await saveToGallery(uri)
      if (saved) results.push(saved)
    }
    return results
  }, [saveToGallery])

  const getThumbnail = useCallback(async (assetId: string): Promise<string | null> => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(assetId)
      return info.localUri || info.uri || null
    } catch {
      return null
    }
  }, [])

  const toggleSelection = useCallback((asset: GalleryAsset) => {
    setSelectedAssets(prev => {
      const exists = prev.find(a => a.id === asset.id)
      if (exists) {
        return prev.filter(a => a.id !== asset.id)
      }
      if (prev.length >= 5) {
        return prev
      }
      return [...prev, asset]
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedAssets([])
    setIsSelectionMode(false)
  }, [])

  const getAssetInfo = useCallback(async (assetId: string): Promise<GalleryAsset | null> => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(assetId)
      return {
        id: info.id,
        uri: info.uri,
        filename: info.filename || `asset_${info.id}`,
        mediaType: normalizeMediaType(info.mediaType),
        width: info.width || 0,
        height: info.height || 0,
        creationTime: info.creationTime || Date.now(),
        duration: info.duration,
        modificationTime: info.modificationTime || info.creationTime || Date.now(),
        localUri: (info as any).localUri,
      }
    } catch {
      return null
    }
  }, [])

  const deleteAsset = useCallback(async (assetId: string): Promise<boolean> => {
    try {
      await MediaLibrary.deleteAssetsAsync([assetId])
      setAssets(prev => prev.filter(a => a.id !== assetId))
      setSelectedAssets(prev => prev.filter(a => a.id !== assetId))
      return true
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteAsset' })
      return false
    }
  }, [])

  useEffect(() => {
    if (permission?.status === 'granted') {
      loadAssets('all', true)
    }
  }, [permission?.status])

  return {
    permission,
    requestPermission,
    albums,
    assets,
    loading,
    hasMore,
    selectedAssets,
    isSelectionMode,
    setIsSelectionMode,
    loadAssets,
    loadAlbums,
    error,
    saveToGallery,
    saveMultipleToGallery,
    getThumbnail,
    getAssetInfo,
    deleteAsset,
    toggleSelection,
    clearSelection,
    maxSelection: 5,
  }
}

export default useGallery
