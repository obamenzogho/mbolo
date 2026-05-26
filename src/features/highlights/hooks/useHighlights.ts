import { useState, useEffect, useCallback } from 'react'
import {
  fetchHighlights, createHighlight as createHL, deleteHighlight as deleteHL,
  updateHighlightTitle, updateHighlightCover, reorderHighlights,
  addStoryToHighlight, removeStoryFromHighlight,
  uploadCover, updateHighlightMedia,
} from '../services/highlightService'
import type { Highlight } from '../services/highlightService'
import { captureException } from '@/lib/sentry'
import { auth } from '@/lib/firebase'

export function useHighlights(userId: string) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(false)

  const refreshHighlights = useCallback(async (uid?: string) => {
    const targetUid = uid || userId
    if (!targetUid) return
    const items = await fetchHighlights(targetUid)
    setHighlights(items)
  }, [userId])

  const createHighlight = useCallback(async (
    title: string,
    coverUri: string,
    mediaUrls: string[],
  ): Promise<string> => {
    const id = await createHL(title, coverUri, mediaUrls)
    await refreshHighlights()
    return id
  }, [refreshHighlights])

  const addToHighlight = useCallback(async (
    highlightId: string,
    storyId: string,
    storyMediaUrl?: string,
  ) => {
    await addStoryToHighlight(highlightId, storyId)
    const user = auth.currentUser
    if (user) await refreshHighlights(user.uid)
  }, [refreshHighlights])

  const removeFromHighlight = useCallback(async (highlightId: string, storyId: string) => {
    await removeStoryFromHighlight(highlightId, storyId)
    const user = auth.currentUser
    if (user) await refreshHighlights(user.uid)
  }, [refreshHighlights])

  const deleteHighlight = useCallback(async (highlightId: string) => {
    try {
      await deleteHL(highlightId)
      const user = auth.currentUser
      if (user) await refreshHighlights(user.uid)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useHighlights/deleteHighlight' })
    }
  }, [refreshHighlights])

  const updateTitle = useCallback(async (highlightId: string, title: string) => {
    await updateHighlightTitle(highlightId, title)
    const user = auth.currentUser
    if (user) await refreshHighlights(user.uid)
  }, [refreshHighlights])

  const updateCover = useCallback(async (highlightId: string, coverUri: string) => {
    await updateHighlightCover(highlightId, coverUri)
    const user = auth.currentUser
    if (user) await refreshHighlights(user.uid)
  }, [refreshHighlights])

  const updateMedia = useCallback(async (
    highlightId: string,
    mediaUrls: string[],
    coverUrl?: string,
  ) => {
    await updateHighlightMedia(highlightId, mediaUrls, coverUrl)
    const user = auth.currentUser
    if (user) await refreshHighlights(user.uid)
  }, [refreshHighlights])

  const reorder = useCallback(async (orderedIds: string[]) => {
    await reorderHighlights(orderedIds)
    const user = auth.currentUser
    if (user) await refreshHighlights(user.uid)
  }, [refreshHighlights])

  useEffect(() => {
    if (userId) {
      setLoading(true)
      refreshHighlights(userId).then(() => setLoading(false))
    }
  }, [userId, refreshHighlights])

  return {
    highlights,
    loading,
    getHighlights: refreshHighlights,
    createHighlight,
    addToHighlight,
    removeFromHighlight,
    deleteHighlight,
    updateHighlightTitle: updateTitle,
    updateHighlightCover: updateCover,
    updateHighlightMedia: updateMedia,
    reorderHighlights: reorder,
    uploadCover,
  }
}
