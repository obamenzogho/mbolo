import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useStoriesFeed } from '@/features/stories/hooks/useStoriesFeed'
import StoryViewer from '@/features/stories/components/StoryViewer'
import { StoryCard } from '@/features/stories/components/StoryCard'
import { StoryCardSkeleton } from '@/features/news/components/Skeletons'
import { useStories } from '@/hooks/useStories'
import PageWrapper from '@/components/PageWrapper'

export default function StoriesScreen() {
  const uid = auth.currentUser?.uid ?? ''
  const { markAsViewed } = useStories()

  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'users', uid), (snap: any) => {
      const data = snap.data()
      setFollowingIds(Array.isArray(data?.following) ? data!.following : [])
    })
  }, [uid])

  const { groups: storyGroups, loading: storiesLoading } = useStoriesFeed(followingIds)

  const myStoryGroup = useMemo(() => storyGroups.find((g) => g.userId === uid), [storyGroups, uid])
  const otherStoryGroups = useMemo(() => storyGroups.filter((g) => g.userId !== uid), [storyGroups, uid])

  const openStory = (userId: string) => {
    const idx = storyGroups.findIndex((g) => g.userId === userId)
    if (idx !== -1) setViewerGroupIndex(idx)
  }

  return (
    <PageWrapper type="stack" swipeBack swipeBackEdgeOnly>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Stories</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesRow}
        >
          {myStoryGroup && (
            <StoryCard group={myStoryGroup} onPress={() => openStory(uid)} />
          )}

          {otherStoryGroups.map((group) => (
            <StoryCard key={group.userId} group={group} onPress={() => openStory(group.userId)} />
          ))}

          {storiesLoading && (
            <>
              <StoryCardSkeleton />
              <StoryCardSkeleton />
              <StoryCardSkeleton />
            </>
          )}
        </ScrollView>

        {viewerGroupIndex !== null && (
          <Modal animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setViewerGroupIndex(null)}>
            <StoryViewer
              groups={storyGroups}
              initialGroupIndex={viewerGroupIndex}
              onClose={() => setViewerGroupIndex(null)}
              onViewed={(storyId) => { if (uid) markAsViewed(storyId, uid) }}
            />
          </Modal>
        )}
      </SafeAreaView>
    </PageWrapper>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  topBar: {
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: '#111214',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2B2E',
  },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  storiesRow: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#111214' },
})
