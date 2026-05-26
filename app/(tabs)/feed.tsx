import { useRef, useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { useSharedValue } from 'react-native-reanimated'
import PagerView from 'react-native-pager-view'
import { colors } from '../../src/lib/theme'
import CommentModal from '../../src/components/CommentModal'
import ShareModal from '../../src/components/ShareModal'
import type { ShareVideoData } from '../../src/components/ShareModal'
import { FeedTopBar } from '../../src/features/feed/components/FeedTopBar'
import { FeedPage } from '../../src/features/feed/components/FeedPage'
import { useSuggestions } from '../../src/hooks/useSuggestions'
import PageWrapper from '../../src/components/PageWrapper'
import { clearSeenVideos } from '../../src/features/feed/services/feedService'
import type { FeedMode } from '../../src/features/feed/hooks/useVideoFeed'
import { useCreateModal } from '../../src/contexts/CreateModalContext'

export default function Feed() {
  const pagerRef = useRef<PagerView>(null)
  const [page, setPage] = useState(0)
  const pageScrollPos = useSharedValue(0)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)
  const [shareData, setShareData] = useState<ShareVideoData | null>(null)
  const [isTabFocused, setIsTabFocused] = useState(true)
  const [clearToken, setClearToken] = useState(0)
  const { openCreateModal } = useCreateModal()
  const { users: suggestedUsers, loading: suggestionsLoading } = useSuggestions()

  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true)
      return () => setIsTabFocused(false)
    }, []),
  )

  const onTabPress = useCallback((p: number) => {
    pagerRef.current?.setPage(p)
  }, [])

  const onPageScroll = useCallback((e: any) => {
    pageScrollPos.value = e.nativeEvent.position + e.nativeEvent.offset
  }, [pageScrollPos])

  const onPageSelected = useCallback((e: any) => {
    setPage(e.nativeEvent.position)
  }, [])

  const openComments = useCallback((videoId: string) => setCommentVideoId(videoId), [])
  const closeComments = useCallback(() => setCommentVideoId(null), [])
  const handleClearSeen = useCallback(async () => {
    await clearSeenVideos()
    setClearToken(t => t + 1)
  }, [])
  const handleFeedReady = useCallback((_mode: FeedMode) => {
    // Neighbour feed finished loading — nothing extra to do,
    // both feeds are already mounted and loading in parallel.
  }, [])

  const feedPages = (
    <PagerView
      ref={pagerRef}
      style={styles.pager}
      initialPage={0}
      offscreenPageLimit={1}
      onPageScroll={onPageScroll}
      onPageSelected={onPageSelected}
    >
      <FeedPage
        key="pourtoi"
        mode="pourtoi"
        isPageActive={page === 0}
        isTabFocused={isTabFocused}
        clearToken={clearToken}
        onReady={handleFeedReady}
        onPressComments={openComments}
        onOpenShare={setShareData}
        suggestedUsers={suggestedUsers}
        suggestionsLoading={suggestionsLoading}
      />
      <FeedPage
        key="suivi"
        mode="suivi"
        isPageActive={page === 1}
        isTabFocused={isTabFocused}
        clearToken={clearToken}
        onReady={handleFeedReady}
        onPressComments={openComments}
        onOpenShare={setShareData}
        suggestedUsers={suggestedUsers}
        suggestionsLoading={suggestionsLoading}
      />
    </PagerView>
  )

  return (
    <PageWrapper type="fadeSlide" style={{ backgroundColor: colors.black }}>
      <View style={styles.container}>
        {feedPages}
        <FeedTopBar pageScrollPos={pageScrollPos} onTabPress={onTabPress} onClearSeen={handleClearSeen} onOpenCreate={openCreateModal} />
        <CommentModal
          visible={commentVideoId !== null}
          onClose={closeComments}
          videoId={commentVideoId || ''}
        />
        <ShareModal
          visible={shareData !== null}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      </View>
    </PageWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  pager: {
    flex: 1,
  },
})
