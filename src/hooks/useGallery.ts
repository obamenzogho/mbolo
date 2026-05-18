import { useState, useCallback, useEffect, useRef } from 'react'
import * as MediaLibrary from 'expo-media-library'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'

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

export const useGallery = () => {
  const [permission, requestPermission] = MediaLibrary.usePermissions()
  const [albums, setAlbums] = useState<GalleryAlbum[]>([])
  const [assets, setAssets] = useState<GalleryAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<GalleryAsset[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const loadAssets = useCallback(async (
    mediaType: 'all' | 'photo' | 'video' = 'all',
    reset = false
  ) => {
    if (loading || (!hasMore && !reset)) return
    if (permission?.status !== 'granted') return

    setLoading(true)
    try {
      const options: any = {
        first: 30,
        sortBy: [MediaLibrary.SortBy.CREATION_TIME_DESC],
      }

      if (mediaType === 'photo') {
        options.mediaType = MediaLibrary.MediaType.photo
      } else if (mediaType === 'video') {
        options.mediaType = MediaLibrary.MediaType.video
      } else {
        options.mediaType = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
      }

      if (!reset && cursor) {
        options.after = cursor
      }

      const result = await MediaLibrary.getAssetsAsync(options)
      const mappedAssets: GalleryAsset[] = result.assets.map((a: any) => ({
        id: a.id,
        uri: a.uri,
        filename: a.filename || `media_${a.id}`,
        mediaType: a.mediaType,
        width: a.width || 0,
        height: a.height || 0,
        creationTime: a.creationTime || Date.now(),
        duration: a.duration,
        modificationTime: a.modificationTime || a.creationTime || Date.now(),
        localUri: a.localUri,
      }))

      setAssets(prev => reset ? mappedAssets : [...prev, ...mappedAssets])
      setCursor(result.endCursor)
      setHasMore(result.hasNextPage)
    } catch (e) {
      console.error('loadAssets error:', e)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, cursor, permission])

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
      console.error('loadAlbums error:', e)
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
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
        duration: asset.duration,
        modificationTime: asset.modificationTime,
        localUri: asset.localUri,
      }

      try {
        let mboloAlbum = await MediaLibrary.getAlbumAsync(MBOLO_ALBUM_NAME)
        if (!mboloAlbum) {
          await MediaLibrary.createAlbumAsync(MBOLO_ALBUM_NAME, asset, false)
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], mboloAlbum, false)
        }
      } catch (e) {
        console.log('Could not add to Mbolo album:', e)
      }

      return mapped
    } catch (e) {
      console.error('saveToGallery error:', e)
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
        mediaType: info.mediaType,
        width: info.width || 0,
        height: info.height || 0,
        creationTime: info.creationTime || Date.now(),
        duration: info.duration,
        modificationTime: info.modificationTime || info.creationTime || Date.now(),
        localUri: info.localUri,
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
      console.error('deleteAsset error:', e)
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