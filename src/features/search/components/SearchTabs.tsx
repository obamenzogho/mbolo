import { useState, memo, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { colors } from '@/lib/theme'
import { UserResultCard } from './UserResultCard'
import { HashtagResultCard } from './HashtagResultCard'
import { VideoResultCard } from './VideoResultCard'
import { PostResultCard } from './PostResultCard'
import type {
  MergedResult,
  UserResult,
  HashtagResult,
  PostResult,
  PostMediaType,
} from '@/services/searchService'
import { filterPostsByType } from '@/services/searchService'
import OrbitLoader from '@/components/OrbitLoader'

type Tab = 'tout' | 'comptes' | 'publications' | 'videos' | 'tags'

interface SearchTabsProps {
  merged: MergedResult[]
  users: UserResult[]
  hashtags: HashtagResult[]
  posts: PostResult[]
  videos: PostResult[]
  loading: boolean
  onResultSelect?: () => void
  initialTab?: Tab
  term?: string
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'tout', label: 'Tout' },
  { key: 'comptes', label: 'Comptes' },
  { key: 'publications', label: 'Posts' },
  { key: 'videos', label: 'Vidéos' },
  { key: 'tags', label: 'Tags' },
]

export const SearchTabs = memo(function SearchTabs({
  merged, users, hashtags, posts, videos, loading, onResultSelect, initialTab, term,
}: SearchTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'tout')

  const nonVideoPosts = useMemo(
    () => filterPostsByType(posts, ['text', 'image', 'carousel', 'article', 'video_share'] as PostMediaType[]),
    [posts],
  )

  const videoPosts = useMemo(
    () => filterPostsByType(posts, ['video'] as PostMediaType[]),
    [posts],
  )

  const counts: Record<Tab, number> = {
    tout: merged.length || (users.length + nonVideoPosts.length + videoPosts.length + hashtags.length),
    comptes: users.length,
    publications: nonVideoPosts.length,
    videos: videoPosts.length,
    tags: hashtags.length,
  }

  const renderList = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.loaderWrap}>
          <OrbitLoader size={24} />
      </View>
      )
    }

    if (activeTab === 'tout') {
      if (merged.length === 0) return <EmptyState term="Tout" />
      return (
        <FlatList
          data={merged}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item }) => {
            if (item.type === 'user' && item.user) {
              return <UserResultCard user={item.user} onPress={onResultSelect} term={term} />
            }
            if (item.type === 'hashtag' && item.hashtag) {
              return <HashtagResultCard tag={item.hashtag.tag} videoCount={item.hashtag.videoCount} onPress={onResultSelect} term={term} />
            }
            if (item.type === 'post' && item.post) {
              return <PostResultCard post={item.post} onPress={onResultSelect} term={term} />
            }
            return null
          }}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )
    }

    if (activeTab === 'comptes') {
      if (users.length === 0) return <EmptyState term="Comptes" />
      return (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserResultCard user={item} onPress={onResultSelect} term={term} />}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )
    }

    if (activeTab === 'publications') {
      if (nonVideoPosts.length === 0) return <EmptyState term="Posts" />
      return (
        <FlatList
          data={nonVideoPosts}
          keyExtractor={(item) => `post-${item.id}`}
          renderItem={({ item }) => <PostResultCard post={item} onPress={onResultSelect} term={term} />}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )
    }

    if (activeTab === 'videos') {
      if (videoPosts.length === 0) return <EmptyState term="Vidéos" />
      return (
        <FlatList
          data={videoPosts}
          numColumns={2}
          keyExtractor={(item) => `video-${item.id}`}
          renderItem={({ item }) => <VideoResultCard video={item} onPress={onResultSelect} term={term} grid />}
          style={styles.list}
          contentContainerStyle={styles.gridListContent}
          keyboardShouldPersistTaps="handled"
        />
      )
    }

    if (activeTab === 'tags') {
      if (hashtags.length === 0) return <EmptyState term="Tags" />
      return (
        <FlatList
          data={hashtags}
          keyExtractor={(item) => item.tag}
          renderItem={({ item }) => <HashtagResultCard tag={item.tag} videoCount={item.videoCount} onPress={onResultSelect} term={term} />}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )
    }

    return null
  }, [activeTab, merged, users, hashtags, nonVideoPosts, videoPosts, loading, onResultSelect, term])

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          const count = counts[tab.key]
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
             </Text>
                {count > 0 && (
                  <Text style={[styles.tabCount, active && styles.tabCountActive]}>
                    {count}
               </Text>
                )}
            </View>
         </TouchableOpacity>
          )
        })}
    </View>

      {renderList()}
  </View>
  )
})

function EmptyState({ term }: { term: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>
        Aucun résultat dans {term}
    </Text>
  </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  tab: {
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.textPrimary,
  },
  tabCount: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabCountActive: {
    color: colors.primary,
    backgroundColor: 'rgba(0,200,83,0.12)',
  },
  list: { flex: 1 },
  listContent: { paddingTop: 8, paddingBottom: 90 },
  gridListContent: { paddingTop: 8, paddingBottom: 90, paddingHorizontal: 8 },
  loaderWrap: { alignItems: 'center', paddingTop: 40 },
  emptyWrap: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
})
