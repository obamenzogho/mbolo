import { useRef, useMemo, useCallback } from 'react'
import type { ListRenderItemInfo, NativeSyntheticEvent, NativeScrollEvent } from 'react-native'

interface ViewableItem {
  index: number
  isViewable: boolean
  key: string
  item: any
}

interface OnViewableItemsChangedCallback {
  (info: { viewableItems: ViewableItem[]; changed: ViewableItem[] }): void
}

export function useVideoAutoplay(
  onIndexChange: (index: number) => void,
  threshold = 0.6,
  minimumViewTime = 100,
) {
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: Math.round(threshold * 100),
    minimumViewTime,
  }), [threshold, minimumViewTime])

  const onViewableItemsChanged = useRef<OnViewableItemsChangedCallback>(
    ({ changed }) => {
      const visible = changed.find(c => c.isViewable)
      if (visible) onIndexChange(visible.index)
    }
  ).current

  return {
    viewabilityConfig,
    onViewableItemsChanged,
  }
}
