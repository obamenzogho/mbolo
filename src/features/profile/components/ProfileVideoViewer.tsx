import { useState, useCallback, useRef, useEffect } from 'react'
import { View, FlatList, TouchableOpacity, Modal, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { VideoItem } from '@/features/feed/components/VideoItem'
import { useVideoAutoplay } from '@/features/feed/hooks/useVideoAutoplay'
import CommentModal from '@/components/CommentModal'
import ShareModal from '@/components/ShareModal'
import type { Video as VideoType } from '@/types'
import type { ShareVideoData } from '@/components/ShareModal'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface ProfileVideoViewerProps {
  videos: VideoType[]
  initialIndex: number
  onClose: () => void
  userId: string
  isOwn?: boolean
  profileUser?: { nom?: string; photoURL?: string } | null
}

export function ProfileVideoViewer({
  videos, initialIndex, onClose, userId, isOwn, profileUser,
}: ProfileVideoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)
  const [shareData, setShareData] = useState<ShareVideoData | null>(null)
  const [userMap, setUserMap] = useState<Record<string, { nom: string; photoURL: string }>>({})
  const flatListRef = useRef<FlatList>(null)
  const insets = useSafeAreaInsets()
  const currentUid = auth.currentUser?.uid || ''

  useEffect(() => {
    const uniqueIds = [...new Set(videos.map(v => v.userId))]
    Promise.all(uniqueIds.map(async (uid) => {
      if (uid === userId && profileUser) {
        return { uid, info: { nom: profileUser.nom || '', photoURL: profileUser.photoURL || '' } }
      }
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists()) {
          const d = snap.data()
          return { uid, info: { nom: d.nom || '', photoURL: d.photoURL || '' } }
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'profileViewer/fetchUser' })
      }
      return null
    })).then(results => {
      const map: Record<string, { nom: string; photoURL: string }> = {}
      results.forEach(r => { if (r) map[r.uid] = r.info })
      setUserMap(map)
    })
  }, [videos, userId, profileUser])

  const getUserInfo = useCallback((uid: string) => {
    if (uid === userId && profileUser) {
      return { nom: profileUser.nom || '', photoURL: profileUser.photoURL || '' }
    }
    return userMap[uid] || { nom: '', photoURL: '' }
  }, [userId, profileUser, userMap])

  const handlePressComments = useCallback((videoId: string) => {
    setCommentVideoId(videoId)
  }, [])

  const handleOpenShare = useCallback((data: ShareVideoData) => {
    setShareData(data)
  }, [])

  const { viewabilityConfig, onViewableItemsChanged } = useVideoAutoplay(setCurrentIndex, 0.6, 100)

  const renderItem = useCallback(({ item, index }: { item: VideoType; index: number }) => {
    const userInfo = getUserInfo(item.userId)
    return (
      <VideoItem
        item={item}
        isActive={index === currentIndex}
        isTabFocused={true}
        isPageActive={true}
        onPressComments={() => handlePressComments(item.id)}
        onOpenShare={handleOpenShare}
        savedPosition={0}
        onPositionUpdate={() => {}}
        username={userInfo.nom}
        photoURL={userInfo.photoURL}
        hasUnseenStory={false}
        bottomPadding={4}
        actionOffset={0}
        initialCounts={{
          liked: item.likedBy?.includes(currentUid) ?? false,
          saved: item.savedBy?.includes(currentUid) ?? false,
          likes: item.likes ?? 0,
          saves: item.saves ?? 0,
          comments: item.comments ?? 0,
          shares: item.shares ?? 0,
        }}
      />
    )
  }, [currentIndex, currentUid, getUserInfo, handlePressComments, handleOpenShare])

  const keyExtractor = useCallback((item: VideoType) => item.id, [])

  return (
    <Modal visible animationType="slide" statusBarTranslucent presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={flatListRef}
          data={videos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged as any}
          viewabilityConfig={viewabilityConfig}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
          windowSize={5}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          removeClippedSubviews={true}
        />

        <TouchableOpacity
          onPress={onClose}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <CommentModal
          visible={commentVideoId !== null}
          onClose={() => setCommentVideoId(null)}
          videoId={commentVideoId || ''}
        />
        <ShareModal
          visible={shareData !== null}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      </View>
    </Modal>
  )
}
