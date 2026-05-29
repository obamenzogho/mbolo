/* useVisibleIndex — détection de visibilité.
   Rôle : seuil 85%, debounce 50ms, appele onIndexChange
   au lieu d'écrire dans un store directement.
   Découplé : le caller fournit les callbacks (feedStore ou local). */

import { useRef, useCallback } from 'react'
import { FEED_DEBUG } from '../store/feedStore'

export interface UseVisibleIndexOptions {
  index: number
  onIndexChange: (newIndex: number) => void
  onScrollBeginDrag: () => void
  onMomentumScrollEnd: () => void
}

export function useVisibleIndex(options: UseVisibleIndexOptions) {
  const { index, onIndexChange, onScrollBeginDrag, onMomentumScrollEnd } = options
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(index)
  indexRef.current = index

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length === 0) return
      const sorted = viewableItems.sort(
        (a, b) => (b.percentInView ?? 0) - (a.percentInView ?? 0),
      )
      const top = sorted[0]
      if (top && top.index != null && top.index !== indexRef.current) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          if (FEED_DEBUG) console.log('[FEED_DEBUG] VISIBLE: index changed', indexRef.current, '→', top.index)
          onIndexChange(top.index)
        }, 50)
      }
    },
  ).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 85,
  }).current

  const handleScrollBeginDrag = useCallback(() => {
    onScrollBeginDrag()
  }, [onScrollBeginDrag])

  const handleMomentumScrollEnd = useCallback(() => {
    onMomentumScrollEnd()
    if (FEED_DEBUG) console.log('[FEED_DEBUG] VISIBLE: snap complete, isScrolling=false')
  }, [onMomentumScrollEnd])

  return {
    onViewableItemsChanged,
    viewabilityConfig,
    handleScrollBeginDrag,
    handleMomentumScrollEnd,
  }
}
