import { memo, useCallback, useRef, useMemo } from 'react'
import { FlatList, View, Dimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import OrbitLoader from '../../../components/OrbitLoader'
import { FeedItem } from './FeedItem'
import { SuggestionFeedCard } from './SuggestionFeedCard'
import type { Video } from '../../../types'
import type { FollowSuggestion } from '@/features/suggestions/types'

const ITEM_HEIGHT = Dimensions.get('window').height
const SUGGESTION_INTERVAL = 6
const SUGGESTION_STRIDE = SUGGESTION_INTERVAL + 1

type FeedMode = 'forYou' | 'following'
type FeedListItem = Video | { type: 'suggestion'; key: string }

function isSuggestionItem(item: FeedListItem): boolean {
  return 'type' in item && item.type === 'suggestion'
}

function flatToVideoIdx(flatIdx: number, mode: FeedMode): number {
  if (mode === 'following') return Math.max(0, flatIdx - 1)
  return flatIdx - Math.floor((flatIdx + 1) / SUGGESTION_STRIDE)
}

interface FeedListProps {
  videos: Video[]
  suggestions: FollowSuggestion[]
  onDismissSuggestion: (id: string) => void
  isLoadingMore: boolean
  hasMore: boolean
  instanceId?: string
  feedType?: FeedMode
  currentIndex: number
  setCurrentIndex: (index: number) => void
  setIsScrolling: (scrolling: boolean) => void
  isActive?: boolean
  userNames?: Record<string, string>
  userPhotos?: Record<string, string>
  onLongPress?: (videoId: string) => void
  onPressComment?: (videoId: string) => void
  onPressShare?: (videoId: string) => void
  refreshing?: boolean
  onRefresh?: () => void
  scrollEnabled?: boolean
}

function FeedListComponent({
  videos,
  suggestions,
  onDismissSuggestion,
  isLoadingMore,
  hasMore,
  instanceId = 'feed',
  feedType = 'forYou',
  currentIndex,
  setCurrentIndex,
  setIsScrolling,
  isActive = true,
  userNames = {},
  userPhotos = {},
  onLongPress,
  onPressComment,
  onPressShare,
  refreshing = false,
  onRefresh,
  scrollEnabled = true,
}: FeedListProps) {
  const indexRef = useRef(currentIndex)
  indexRef.current = currentIndex
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScrollBeginDrag = useCallback(() => {
    setIsScrolling(true)
  }, [setIsScrolling])

  const handleMomentumScrollEnd = useCallback(() => {
    setIsScrolling(false)
  }, [setIsScrolling])

  const data = useMemo<FeedListItem[]>(() => {
    if (!suggestions || suggestions.length === 0) return videos as FeedListItem[]
    const items: FeedListItem[] = []

    if (feedType === 'following') {
      items.push({ type: 'suggestion', key: 'suggestion-0' })
      for (let i = 0; i < videos.length; i++) {
        items.push(videos[i])
      }
    } else {
      for (let i = 0; i < videos.length; i++) {
        items.push(videos[i])
        if ((i + 1) % SUGGESTION_INTERVAL === 0) {
          items.push({ type: 'suggestion', key: `suggestion-${items.length}` })
        }
      }
    }

    return items
  }, [videos, suggestions, feedType])

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      const videoItems = viewableItems.filter(
        (v: any) => !(v.item && isSuggestionItem(v.item)),
      )
      if (videoItems.length === 0) return
      const sorted = [...videoItems].sort(
        (a, b) => (b.percentInView ?? 0) - (a.percentInView ?? 0),
      )
      const top = sorted[0]
      if (top && top.index != null) {
        const videoIdx = flatToVideoIdx(top.index, feedType)
        if (videoIdx !== indexRef.current) {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            setCurrentIndex(videoIdx)
          }, 50)
        }
      }
    },
  ).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 85,
  }).current

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isActive) return
    handleMomentumScrollEnd()
  }, [isActive, handleMomentumScrollEnd])

  const renderItem = useCallback(
    ({ item, index }: { item: FeedListItem; index: number }) => {
      if (isSuggestionItem(item)) {
        const nextItem = data[index + 1]
        const nextVideoId = nextItem && !isSuggestionItem(nextItem) ? (nextItem as Video).id : undefined
        return (
          <SuggestionFeedCard
            suggestions={suggestions}
            onDismiss={onDismissSuggestion}
            horizontal={feedType === 'following'}
            nextVideoId={nextVideoId}
            instanceId={instanceId}
          />
        )
      }
      const video = item as Video
      const videoIndex = flatToVideoIdx(index, feedType)
      return (
        <FeedItem
          item={video}
          index={videoIndex}
          instanceId={instanceId}
          currentIndex={currentIndex}
          username={userNames[video.userId]}
          userPhotoURL={userPhotos[video.userId]}
          onLongPress={onLongPress ? () => onLongPress(video.id) : undefined}
          onPressComment={onPressComment ? () => onPressComment(video.id) : undefined}
          onPressShare={onPressShare ? () => onPressShare(video.id) : undefined}
        />
      )
    },
    [instanceId, currentIndex, userNames, userPhotos, onLongPress, onPressComment, onPressShare, suggestions, onDismissSuggestion, feedType, data],
  )

  const keyExtractor = useCallback((item: FeedListItem) => {
    if (isSuggestionItem(item)) return item.key
    return item.id
  }, [])

  const listFooter = useCallback(
    () =>
      isLoadingMore ? (
        <View style={{ height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
          <OrbitLoader size={24} />
        </View>
      ) : null,
    [isLoadingMore],
  )

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      snapToAlignment="start"
      decelerationRate="fast"
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onScrollBeginDrag={() => isActive && handleScrollBeginDrag()}
      onMomentumScrollEnd={handleMomentumEnd}
      windowSize={3}
      maxToRenderPerBatch={1}
      initialNumToRender={1}
      removeClippedSubviews={false}
      ListFooterComponent={listFooter}
      getItemLayout={(_data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      scrollEnabled={scrollEnabled}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  )
}

export const FeedList = memo(FeedListComponent)
