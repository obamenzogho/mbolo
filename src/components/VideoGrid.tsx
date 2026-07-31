import { useCallback, useRef } from 'react'
import { View, Text, FlatList, Dimensions, Platform } from 'react-native'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
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
  reposted: { icon: 'repeat-outline', title: 'Aucune republication', subtitle: 'Les vidéos republiées apparaîtront ici' },
  tagged: { icon: 'pricetag-outline', title: 'Aucune identification', subtitle: 'Les vidéos où tu es identifié(e) apparaîtront ici' },
  reels: { icon: 'film-outline', title: 'Aucun réel', subtitle: 'Les réels apparaîtront ici' },
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
  /**
   * Geste externe composé en simultané (ex. le pan de swipe-back du profil).
   * Nécessaire : l'arène des gestes de ce composant neutralise sinon tout
   * geste de retour ancêtre ou natif.
   */
  simultaneousGesture?: GestureType
}

export function VideoGrid({
  videos, tab, loading, refreshing,
  onRefresh, loadMore, hasMore, isOwn,
  ListHeaderComponent, onThumbnailPress, simultaneousGesture,
}: VideoGridProps) {
  const refreshingRef = useRef(false)
  refreshingRef.current = refreshing
  const pullTriggeredRef = useRef(false)
  const scrollOffsetY = useSharedValue(0)

  const renderItem = useCallback(
    ({ item }: { item: VideoType }) => <VideoThumbnailCell item={item} isOwn={isOwn} onPress={onThumbnailPress} />,
    [isOwn, onThumbnailPress],
  )

  const keyExtractor = useCallback((item: VideoType) => item.id, [])

  const handleRefresh = useCallback(() => {
    if (onRefresh && !refreshingRef.current) {
      onRefresh()
    }
  }, [onRefresh])

  // iOS : le GestureDetector du pull-to-refresh custom neutralise le swipe-back
  // natif du native-stack. Sur iOS on renonce au détecteur et on déclenche le
  // refresh via le rebond du scroll (contentOffset négatif), comportement natif.
  const isIOS = Platform.OS === 'ios'

  const onScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y
    scrollOffsetY.value = y
    if (isIOS && !pullTriggeredRef.current && y < -80) {
      pullTriggeredRef.current = true
      handleRefresh()
    } else if (y > -20) {
      pullTriggeredRef.current = false
    }
  }, [handleRefresh])

  const nativeGesture = Gesture.Native()
  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onEnd((e, success) => {
      if (success && scrollOffsetY.value <= 0 && e.translationY > 80) {
        runOnJS(handleRefresh)()
      }
    })
  const composedGesture = simultaneousGesture
    ? Gesture.Simultaneous(Gesture.Simultaneous(nativeGesture, panGesture), simultaneousGesture)
    : Gesture.Simultaneous(nativeGesture, panGesture)

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
    const list = (
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
    )
    return isIOS ? list : <GestureDetector gesture={composedGesture}>{list}</GestureDetector>
  }

  const list = (
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
  )
  return isIOS ? list : <GestureDetector gesture={composedGesture}>{list}</GestureDetector>
}
