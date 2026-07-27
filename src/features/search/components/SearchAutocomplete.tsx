import { memo, useMemo, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'
import { UserResultCard } from './UserResultCard'
import { HashtagResultCard } from './HashtagResultCard'
import { VideoResultCard } from './VideoResultCard'
import { PostResultCard } from './PostResultCard'
import type {
  UserResult,
  HashtagResult,
  PostResult,
  PostMediaType,
} from '@/services/searchService'
import { filterPostsByType } from '@/services/searchService'
import OrbitLoader from '@/components/OrbitLoader'

const MAX_PREVIEW = 3

type SearchTab = 'tout' | 'comptes' | 'publications' | 'videos' | 'tags'

type SectionItem =
  | { type: 'section-title'; key: string; title: string; icon: string; count: number; onSeeAll: () => void }
  | { type: 'user'; key: string; user: UserResult; onPress?: () => void }
  | { type: 'hashtag'; key: string; tag: string; videoCount: number; onPress?: () => void }
  | { type: 'video'; key: string; video: PostResult; onPress?: () => void }
  | { type: 'post'; key: string; post: PostResult; onPress?: () => void }
  | { type: 'see-all'; key: string; onSeeAll: () => void }
  | { type: 'empty'; key: string }

interface SearchAutocompleteProps {
  users: UserResult[]
  hashtags: HashtagResult[]
  posts: PostResult[]
  loading: boolean
  term: string
  onSeeAll: (tab: SearchTab) => void
}

export const SearchAutocomplete = memo(function SearchAutocomplete({
  users, hashtags, posts, loading, term, onSeeAll,
}: SearchAutocompleteProps) {
  const { nonVideoPosts, videoPosts } = useMemo(() => {
    const v: PostMediaType[] = ['video']
    const others: PostMediaType[] = ['text', 'image', 'carousel', 'article', 'video_share']
    return {
      videoPosts: filterPostsByType(posts, v),
      nonVideoPosts: filterPostsByType(posts, others),
    }
  }, [posts])

  const data = useMemo<SectionItem[]>(() => {
    const items: SectionItem[] = []

    const previewUsers = users.slice(0, MAX_PREVIEW)
    if (previewUsers.length > 0) {
      items.push({ type: 'section-title', key: 'sec-users', title: 'Personnes', icon: 'person', count: users.length, onSeeAll: () => onSeeAll('comptes') })
      for (const u of previewUsers) {
        items.push({ type: 'user', key: `user-${u.id}`, user: u })
      }
      if (users.length > MAX_PREVIEW) {
        items.push({ type: 'see-all', key: 'see-all-users', onSeeAll: () => onSeeAll('comptes') })
      }
    }

    const previewHashtags = hashtags.slice(0, MAX_PREVIEW)
    if (previewHashtags.length > 0) {
      items.push({ type: 'section-title', key: 'sec-tags', title: 'Tags', icon: 'pricetag', count: hashtags.length, onSeeAll: () => onSeeAll('tags') })
      for (const t of previewHashtags) {
        items.push({ type: 'hashtag', key: `tag-${t.tag}`, tag: t.tag, videoCount: t.videoCount })
      }
      if (hashtags.length > MAX_PREVIEW) {
        items.push({ type: 'see-all', key: 'see-all-tags', onSeeAll: () => onSeeAll('tags') })
      }
    }

    const previewVideos = videoPosts.slice(0, MAX_PREVIEW)
    if (previewVideos.length > 0) {
      items.push({ type: 'section-title', key: 'sec-videos', title: 'Vidéos', icon: 'videocam', count: videoPosts.length, onSeeAll: () => onSeeAll('videos') })
      for (const v of previewVideos) {
        items.push({ type: 'video', key: `video-${v.id}`, video: v })
      }
      if (videoPosts.length > MAX_PREVIEW) {
        items.push({ type: 'see-all', key: 'see-all-videos', onSeeAll: () => onSeeAll('videos') })
      }
    }

    const previewPosts = nonVideoPosts.slice(0, MAX_PREVIEW)
    if (previewPosts.length > 0) {
      items.push({ type: 'section-title', key: 'sec-posts', title: 'Publications', icon: 'document-text', count: nonVideoPosts.length, onSeeAll: () => onSeeAll('publications') })
      for (const p of previewPosts) {
        items.push({ type: 'post', key: `post-${p.id}`, post: p })
      }
      if (nonVideoPosts.length > MAX_PREVIEW) {
        items.push({ type: 'see-all', key: 'see-all-posts', onSeeAll: () => onSeeAll('publications') })
      }
    }

    if (items.length === 0) {
      items.push({ type: 'empty', key: 'empty' })
    }

    return items
  }, [users, hashtags, videoPosts, nonVideoPosts, onSeeAll])

  const renderItem = useCallback(({ item }: { item: SectionItem }) => {
    switch (item.type) {
      case 'section-title':
        return (
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleLeft}>
              <Ionicons name={item.icon as any} size={14} color={colors.textMuted} />
              <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
            <TouchableOpacity onPress={item.onSeeAll} style={styles.seeAllPill}>
              <Text style={styles.seeAllText}>Voir tout ({item.count})</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.primary} />
      </TouchableOpacity>
      </View>
        )
      case 'user':
        return <UserResultCard user={item.user} term={term} />
      case 'hashtag':
        return <HashtagResultCard tag={item.tag} videoCount={item.videoCount} term={term} />
      case 'video':
        return <VideoResultCard video={item.video} term={term} />
      case 'post':
        return <PostResultCard post={item.post} term={term} />
      case 'see-all':
        return (
          <TouchableOpacity style={styles.seeAllRow} onPress={item.onSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAllLink}>Voir tout →</Text>
    </TouchableOpacity>
        )
      case 'empty':
        return (
          <View style={styles.emptyWrap}>
            <Ionicons name="search-outline" size={36} color="#444" />
            <Text style={styles.emptyText}>Aucun résultat</Text>
    </View>
        )
      default:
        return null
    }
  }, [term])

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <OrbitLoader size={24} />
  </View>
    )
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
    />
  )
})

const styles = StyleSheet.create({
  listContent: { paddingTop: 4, paddingBottom: 90 },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,200,83,0.1)',
    borderRadius: 10,
  },
  seeAllText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  seeAllRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  seeAllLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  loaderWrap: { alignItems: 'center', paddingTop: 60 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
})
