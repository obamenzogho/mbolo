import { useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Keyboard,
  ScrollView, Share, Modal, StyleSheet, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { colors } from '@/lib/theme'
import { useTrendingHashtags } from '@/hooks/useTrendingHashtags'
import { useFollowSuggestions } from '@/features/suggestions/hooks/useFollowSuggestions'
import { useInterestGraph } from '@/features/suggestions/hooks/useInterestGraph'
import { SuggestionsSection } from '@/features/suggestions/components/SuggestionsSection'
import { useUserLocation } from '@/features/location/useUserLocation'
import { searchMulti, normalizeAndMerge, mapPostHit } from '@/services/searchService'
import type {
  UserResult,
  HashtagResult,
  PostResult,
  MergedResult,
} from '@/services/searchService'
import { auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { SearchTabs } from '@/features/search/components/SearchTabs'
import { SearchAutocomplete } from '@/features/search/components/SearchAutocomplete'
import { useRecentSearches } from '@/features/search/hooks/useRecentSearches'
import { RecentSearches } from '@/features/search/components/RecentSearches'
import OrbitLoader from '@/components/OrbitLoader'
import { BackButton } from '@/components/ui/BackButton'

type SearchTab = 'tout' | 'comptes' | 'publications' | 'videos' | 'tags'

export default function Explore() {
  const { from } = useLocalSearchParams<{ from?: string }>()
  const backTo = typeof from === 'string' && from ? from : '/(tabs)/feed'
  const handleBack = useCallback(() => {
    router.replace(backTo as any)
  }, [backTo])

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [optionsVisible, setOptionsVisible] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [activeSearchTab, setActiveSearchTab] = useState<SearchTab>('tout')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  const [merged, setMerged] = useState<MergedResult[]>([])
  const [users, setUsers] = useState<UserResult[]>([])
  const [hashtags, setHashtags] = useState<HashtagResult[]>([])
  const [posts, setPosts] = useState<PostResult[]>([])
  const [videos, setVideos] = useState<PostResult[]>([])

  const { place } = useUserLocation()
  const cityLabel = place?.city ?? null

  const { tags: trendingTags, loading: trendingLoading, refresh: refreshTrending } = useTrendingHashtags(12, cityLabel)

  const {
    suggestions, trending, loading: suggLoading, refreshing,
    refresh: refreshSuggestions, dismissSuggestion, dismissTrending, error: suggError,
  } = useFollowSuggestions({ autoRefresh: true })

  const { topCategories, loading: interestsLoading } = useInterestGraph()

  const { recent, addSearch, removeSearch, clearRecent } = useRecentSearches()

  const isSearching = search.trim().length > 0

  const performSearch = useCallback(async (term: string) => {
    const q = term.trim()
    if (!q) {
      setMerged([]); setUsers([]); setHashtags([]); setPosts([]); setVideos([])
      setLoading(false)
      return
    }

    const currentId = ++requestIdRef.current
    setLoading(true)

    try {
      if (q.startsWith('#')) {
        if (requestIdRef.current !== currentId) return
        setLoading(false)
        router.push({ pathname: '/hashtag/[tag]', params: { tag: q.slice(1) } })
        addSearch(q)
        return
      }

      const multi = await searchMulti(q)
      if (requestIdRef.current !== currentId) return

      setMerged(normalizeAndMerge(multi))

      const me = auth.currentUser?.uid
      setUsers(
        multi.users.hits
          .map((h: any) => h.document as UserResult)
          .filter((u) => u.id !== me),
      )
      setHashtags(multi.hashtags.hits.map((h: any) => h.document as HashtagResult))

      const allPosts: PostResult[] = multi.posts.hits.map(mapPostHit)
      setPosts(allPosts)
      setVideos(allPosts.filter((p) => p.mediaType === 'video' || p.mediaType === 'video_share'))
    } catch (e) {
      if (requestIdRef.current !== currentId) return
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'explore.performSearch' })
      setMerged([]); setUsers([]); setHashtags([]); setPosts([]); setVideos([])
    }
    if (requestIdRef.current === currentId) setLoading(false)
  }, [addSearch])

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text)
    setHasSubmitted(false)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!text.trim()) {
      setMerged([]); setUsers([]); setHashtags([]); setPosts([]); setVideos([])
      return
    }
    searchTimeout.current = setTimeout(() => performSearch(text), 400)
  }, [performSearch])

  const handleInputBlur = useCallback(() => {
    setInputFocused(false)
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
      searchTimeout.current = null
    }
  }, [])

  const handleTagPress = (tag: string) => {
    const withHash = tag.startsWith('#') ? tag : `#${tag}`
    setSearch(withHash)
    performSearch(withHash)
  }

  const onRefreshAll = useCallback(() => {
    refreshTrending()
    refreshSuggestions()
  }, [refreshTrending, refreshSuggestions])

  const handleSeeAll = useCallback((tab: SearchTab) => {
    Keyboard.dismiss()
    setActiveSearchTab(tab)
    setHasSubmitted(true)
  }, [])

  const showAutocomplete = isSearching && !hasSubmitted
  const showResults =
    isSearching &&
    (hasSubmitted ||
      (!loading && (merged.length > 0 || users.length > 0 || hashtags.length > 0 || posts.length > 0)))

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <BackButton icon="chevron-back" onPress={handleBack} style={styles.backBtn} />
        <Text style={styles.title}>Découvrir</Text>
        <TouchableOpacity onPress={() => setOptionsVisible(true)} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
     </TouchableOpacity>
   </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          value={search}
          onChangeText={handleSearchChange}
          onSubmitEditing={() => { if (search.trim()) { addSearch(search.trim()); setHasSubmitted(true) } }}
          onFocus={() => setInputFocused(true)}
          onBlur={handleInputBlur}
          placeholder="Rechercher un profil, #hashtag…"
          placeholderTextColor="#777"
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {loading && <OrbitLoader size={16} />}
        {search.length > 0 && !loading && (
          <TouchableOpacity
            onPress={() => {
              setSearch('')
              setMerged([]); setUsers([]); setHashtags([]); setPosts([]); setVideos([])
              setHasSubmitted(false)
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color="#888" />
       </TouchableOpacity>
        )}
   </View>

      {showAutocomplete ? (
        <SearchAutocomplete
          users={users}
          hashtags={hashtags}
          posts={posts}
          loading={loading}
          term={search}
          onSeeAll={handleSeeAll}
        />
      ) : showResults ? (
        <SearchTabs
          key={`search-tabs-${activeSearchTab}`}
          merged={merged}
          users={users}
          hashtags={hashtags}
          posts={posts}
          videos={videos}
          loading={loading}
          onResultSelect={() => { if (search.trim()) addSearch(search.trim()) }}
          initialTab={activeSearchTab}
          term={search}
        />
      ) : loading ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <OrbitLoader size={24} />
     </View>
      ) : isSearching ? (
        <View style={styles.emptySearch}>
          <Ionicons name="search-outline" size={44} color="#555" />
          <Text style={styles.emptyText}>Aucun résultat pour "{search}"</Text>
   </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingVertical: 16, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} tintColor={colors.primary} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {inputFocused && recent.length > 0 && (
            <RecentSearches
              recent={recent}
              onSelect={(term) => { setSearch(term); performSearch(term) }}
              onRemove={removeSearch}
              onClear={clearRecent}
            />
          )}

          {!interestsLoading && topCategories.length > 0 && (
            <View style={styles.interestsCard}>
              <View style={styles.interestsHeader}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.interestsTitle}>Tes centres d'intérêt</Text>
       </View>
              <View style={styles.chipRow}>
                {topCategories.map((cat) => (
                  <View key={cat} style={styles.interestChip}>
                    <Text style={styles.interestChipText}>{cat}</Text>
         </View>
                ))}
       </View>
     </View>
          )}

          <View style={{ marginTop: 20 }}>
            <SuggestionsSection
              title="Suggestions pour toi"
              suggestions={suggestions}
              loading={suggLoading}
              onDismiss={dismissSuggestion}
              error={suggError}
              carousel
            />
     </View>

          {trending.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <SuggestionsSection
                title="Créateurs en vogue"
                suggestions={trending}
                onDismiss={dismissTrending}
                compact
              />
       </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            {cityLabel ? `Tendances à ${cityLabel}` : 'Tendances au Gabon'}
       </Text>
          {trendingLoading ? (
            <View style={{ padding: 20 }}><OrbitLoader size={24} /></View>
          ) : trendingTags.length > 0 ? (
            <View style={styles.tagCloud}>
              {trendingTags.map((t) => (
                <TouchableOpacity key={t.tag} onPress={() => handleTagPress(t.tag)} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{t.tag}</Text>
                  <Text style={styles.tagCount}>{t.videoCount}</Text>
       </TouchableOpacity>
              ))}
       </View>
          ) : (
            <Text style={styles.emptyText}>Pas encore de tendances</Text>
          )}
   </ScrollView>
      )}

      {optionsVisible ? (
        <Modal transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
          <TouchableOpacity style={styles.optionsBackdrop} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
            <View style={styles.optionsSheet}>
              {[
                { icon: 'refresh-outline', label: 'Actualiser', action: () => { setOptionsVisible(false); onRefreshAll() } },
                { icon: 'flag-outline', label: 'Signaler un problème', action: () => { setOptionsVisible(false); router.push('/settings') } },
                { icon: 'arrow-redo-outline', label: "Partager l'app", action: () => { setOptionsVisible(false); Share.share({ message: 'Rejoins-moi sur Mbolo ! 🎉' }) } },
              ].map((item, i) => (
                <TouchableOpacity key={i} onPress={item.action} style={styles.optionRow}>
                  <Ionicons name={item.icon as any} size={22} color="#fff" />
                  <Text style={styles.optionLabel}>{item.label}</Text>
       </TouchableOpacity>
              ))}
       </View>
     </TouchableOpacity>
   </Modal>
      ) : null}
 </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  header: { height: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { backgroundColor: '#1A1B1E', borderRadius: 20, padding: 6 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: '#1A1B1E' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A1B1E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2A2C31' },
  tagText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  tagCount: { color: '#777', fontSize: 12 },
  interestsCard: { marginHorizontal: 16, marginBottom: 20, backgroundColor: '#111214', borderRadius: 12, padding: 14 },
  interestsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  interestsTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  interestChip: { backgroundColor: '#25272A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  interestChipText: { color: '#DDD', fontSize: 12, fontWeight: '500' },
  emptySearch: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  optionsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  optionsSheet: { backgroundColor: '#17181B', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8, paddingBottom: 34 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 },
  optionLabel: { color: '#fff', fontSize: 15 },
})
