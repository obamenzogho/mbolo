import { memo, useCallback, useRef, useMemo } from 'react'
import { FlatList, View, Text, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import OrbitLoader from '../../../components/OrbitLoader'
import { FeedItem } from './FeedItem'
import { SuggestionFeedCard } from './SuggestionFeedCard'
import type { Video } from '../../../types'
import type { FollowSuggestion } from '@/features/suggestions/types'

const SUGGESTION_INTERVAL = 6
const SUGGESTION_STRIDE = SUGGESTION_INTERVAL + 1

type FeedMode = 'forYou' | 'following'
type FeedListItem = Video | { type: 'suggestion'; key: string }

function isSuggestionItem(item: FeedListItem): item is { type: 'suggestion'; key: string } {
  return 'type' in item && item.type === 'suggestion'
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
  onLongPress?: (videoId: string) => void
  onPressComment?: (videoId: string) => void
  onPressShare?: (videoId: string) => void
  onPressMore?: (videoId: string) => void
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
  onLongPress,
  onPressComment,
  onPressShare,
  onPressMore,
  refreshing = false,
  onRefresh,
  scrollEnabled = true,
}: FeedListProps) {
  const indexRef = useRef(currentIndex)
  indexRef.current = currentIndex
  const videosRef = useRef(videos)
  videosRef.current = videos
  const { height: SCREEN_HEIGHT } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const ITEM_HEIGHT = SCREEN_HEIGHT - insets.bottom

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
      const videoItems = viewableItems.filter((v) => v.item && !isSuggestionItem(v.item))
      const topVideo = videoItems[0]?.item as Video | undefined
      console.log('[FeedList:viewable] count=', videoItems.length, 'topVideoId=', topVideo?.id, 'currentIndex=', indexRef.current)
      if (videoItems.length === 0) return
      // index réel via l'ID, plus aucun calcul de décalage
      const videoIdx = videosRef.current.findIndex((v) => v.id === topVideo!.id)
      console.log('[FeedList:viewable] → videoIdx=', videoIdx)
      if (videoIdx !== -1 && videoIdx !== indexRef.current) {
        setCurrentIndex(videoIdx)
        setIsScrolling(false)
      }
    },
  ).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
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
      const videoIndex = videos.findIndex((v) => v.id === video.id)
      if (videoIndex === currentIndex) {
        console.log('[FeedList:render] ACTIVE videoId=', video.id, 'videoIndex=', videoIndex)
      }
      return (
        <FeedItem
          item={video}
          index={videoIndex}
          instanceId={instanceId}
          isActive={videoIndex === currentIndex}
          itemHeight={ITEM_HEIGHT}
          onLongPress={onLongPress ? () => onLongPress(video.id) : undefined}
          onPressComment={onPressComment ? () => onPressComment(video.id) : undefined}
          onPressShare={onPressShare ? () => onPressShare(video.id) : undefined}
          onPressMore={onPressMore ? () => onPressMore(video.id) : undefined}
        />
      )
    },
    [instanceId, onLongPress, onPressComment, onPressShare, onPressMore, suggestions, onDismissSuggestion, feedType, data, currentIndex, videos, ITEM_HEIGHT],
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

  const listEmpty = useCallback(
    () => (
      <View style={{ flex: 1, height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <OrbitLoader size={48} />
        <Text style={{ color: '#888', fontSize: 16, fontWeight: '600', marginTop: 20, textAlign: 'center' }}>
          Aucune vidéo pour le moment
        </Text>
        <Text style={{ color: '#555', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
          Appuie sur le bouton + pour créer ton premier reel
        </Text>
      </View>
    ),
    [ITEM_HEIGHT],
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
      windowSize={5}
      maxToRenderPerBatch={3}
      initialNumToRender={3}
      removeClippedSubviews={true}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      getItemLayout={(_data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      scrollEnabled={scrollEnabled}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  )
}

export const FeedList = memo(FeedListComponent)
