import { useCallback, useRef } from 'react'
import { View, Text, FlatList, Dimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'
import { VideoThumbnailCell } from '@/components/VideoThumbnailCell'
import OrbitLoader from '@/components/OrbitLoader'
import type { Video as VideoType, ProfileTab } from '@/types'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_COLS = 3

const EMPTY_MESSAGES: Record<ProfileTab, { icon: string; title: string; subtitle: string }> = {
  grid: { icon: 'videocam-outline', title: 'Aucune publication', subtitle: 'Les vidéos apparaîtront ici' },
  saved: { icon: 'bookmark-outline', title: 'Aucun contenu sauvegardé', subtitle: 'Les vidéos que tu sauvegardes apparaîtront ici' },
  liked: { icon: 'heart-outline', title: 'Aucun contenu aimé', subtitle: 'Les vidéos que tu aimes apparaîtront ici' },
}

interface VideoGridProps {
  videos: VideoType[]
  tab: ProfileTab
  loading: boolean
  refreshing: boolean
  onRefresh?: () => void
  loadMore?: () => void
  hasMore?: boolean
  isOwn?: boolean
  ListHeaderComponent?: React.ReactElement | null
  onThumbnailPress?: (videoId: string) => void
}

export function VideoGrid({
  videos, tab, loading, refreshing,
  onRefresh, loadMore, hasMore, isOwn,
  ListHeaderComponent, onThumbnailPress,
}: VideoGridProps) {
  const scrollOffsetRef = useRef(0)
  const refreshingRef = useRef(false)
  refreshingRef.current = refreshing

  const renderItem = useCallback(
    ({ item }: { item: VideoType }) => <VideoThumbnailCell item={item} isOwn={isOwn} onPress={onThumbnailPress} />,
    [isOwn, onThumbnailPress],
  )

  const keyExtractor = useCallback((item: VideoType) => item.id, [])

  const onScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y
  }, [])

  const handleRefresh = useCallback(() => {
    if (onRefresh && !refreshingRef.current) {
      onRefresh()
    }
  }, [onRefresh])

  const nativeGesture = Gesture.Native()
  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onEnd((e, success) => {
      if (success && scrollOffsetRef.current <= 0 && e.translationY > 80) {
        runOnJS(handleRefresh)()
      }
    })
  const composedGesture = Gesture.Simultaneous(nativeGesture, panGesture)

  const headerWithRefresh = (
    <View>
      {refreshing && (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <OrbitLoader size={36} />
        </View>
      )}
      {ListHeaderComponent}
    </View>
  )

  if (videos.length === 0) {
    const msg = EMPTY_MESSAGES[tab]
    return (
      <GestureDetector gesture={composedGesture}>
        <FlatList
          data={[]}
          numColumns={GRID_COLS}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View>
              {refreshing && (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <OrbitLoader size={36} />
                </View>
              )}
              {ListHeaderComponent}
              <View style={{ paddingVertical: 60, alignItems: 'center', gap: 8 }}>
                <Ionicons name={msg.icon as any} size={48} color="#333" />
                <Text style={{ color: '#666', fontSize: 16, fontWeight: '600' }}>{msg.title}</Text>
                <Text style={{ color: '#555', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>{msg.subtitle}</Text>
                {loading && (
                  <View style={{ paddingTop: 20 }}>
                    <OrbitLoader size={32} />
                  </View>
                )}
              </View>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      </GestureDetector>
    )
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <FlatList
        data={videos}
        numColumns={GRID_COLS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={headerWithRefresh}
        onEndReached={loadMore && hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ flexGrow: 1 }}
        ListFooterComponent={
          loading && videos.length > 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <OrbitLoader size={40} />
            </View>
          ) : null
        }
      />
    </GestureDetector>
  )
}
