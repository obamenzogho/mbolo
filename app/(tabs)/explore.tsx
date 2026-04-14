import { useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, Share, Modal, StyleSheet, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { collection, query, where, getDocs, orderBy, limit, type QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { useTrendingHashtags } from '@/hooks/useTrendingHashtags'
import { useFollowSuggestions } from '@/features/suggestions/hooks/useFollowSuggestions'
import { useInterestGraph } from '@/features/suggestions/hooks/useInterestGraph'
import { SuggestionsSection } from '@/features/suggestions/components/SuggestionsSection'
import OrbitLoader from '@/components/OrbitLoader'
import { BackButton } from '@/components/ui/BackButton'

type ResultType = 'user' | 'post'

interface SearchResult {
  id: string
  type: ResultType
  nom?: string
  pseudo?: string
  photoURL?: string
  text?: string
  thumbnailUrl?: string
}

export default function Explore() {
  const { from } = useLocalSearchParams<{ from?: string }>()
  // Explore est un onglet ouvert depuis plusieurs écrans (Actus, feed vidéo…).
  // Entre onglets, router.back() est peu fiable, donc on renvoie explicitement
  // vers l'écran d'origine passé en paramètre (repli : le feed).
  const backTo = typeof from === 'string' && from ? from : '/(tabs)/feed'
  const handleBack = useCallback(() => {
    router.replace(backTo as any)
  }, [backTo])

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [optionsVisible, setOptionsVisible] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { tags: trendingTags, loading: trendingLoading, refresh: refreshTrending } = useTrendingHashtags(12)

  const {
    suggestions, trending, loading: suggLoading, refreshing,
    refresh: refreshSuggestions, dismissSuggestion, error: suggError,
  } = useFollowSuggestions({ autoRefresh: true })

  const { topCategories, loading: interestsLoading } = useInterestGraph()

  const isSearching = search.trim().length > 0

  const performSearch = useCallback(async (term: string) => {
    const q = term.trim()
    if (!q) { setResults([]); setLoading(false); return }
    setLoading(true)

    // Recherche par hashtag : on ne cherche que des publications.
    if (q.startsWith('#')) {
      const tag = q.slice(1).toLowerCase()
      try {
        const postsSnap = await getDocs(query(
          collection(db, 'posts'),
          where('hashtags', 'array-contains', tag),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          limit(20),
        ))
        const out: SearchResult[] = []
        postsSnap.forEach((d: QueryDocumentSnapshot) => {
          const data = d.data()
          out.push({ id: d.id, type: 'post', text: data.text, thumbnailUrl: data.media?.[0]?.url })
        })
        setResults(out)
      } catch (e) {
        console.error('Search error (hashtag):', e)
        setResults([])
      }
      setLoading(false)
      return
    }

    // Recherche de profils : les pseudos sont stock\u00e9s en minuscules dans
    // `pseudoLower`, donc on normalise le terme et on interroge ce champ
    // (pr\u00e9fixe insensible \u00e0 la casse). L'ancienne requ\u00eate sur `pseudo`
    // \u00e9tait sensible \u00e0 la casse \u2192 \u00ab aucun r\u00e9sultat \u00bb d\u00e8s qu'on tapait une
    // majuscule.
    const qLower = q.toLowerCase()
    try {
      const usersSnap = await getDocs(query(
        collection(db, 'users'),
        orderBy('pseudoLower'),
        where('pseudoLower', '>=', qLower),
        where('pseudoLower', '<=', qLower + '\uf8ff'),
        limit(15),
      ))
      const out: SearchResult[] = []
      usersSnap.forEach((d: QueryDocumentSnapshot) => {
        const data = d.data()
        out.push({ id: d.id, type: 'user', nom: data.nom, pseudo: data.pseudo, photoURL: data.photoURL })
      })
      setResults(out)
    } catch (e) {
      console.error('Search error (users):', e)
      setResults([])
    }
    setLoading(false)
  }, [])

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!text.trim()) { setResults([]); return }
    searchTimeout.current = setTimeout(() => performSearch(text), 400)
  }, [performSearch])

  const handleTagPress = (tag: string) => {
    const withHash = tag.startsWith('#') ? tag : `#${tag}`
    setSearch(withHash)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => performSearch(withHash), 100)
  }

  const onRefreshAll = useCallback(() => {
    refreshTrending()
    refreshSuggestions()
  }, [refreshTrending, refreshSuggestions])

  const renderResult = ({ item }: { item: SearchResult }) => {
    if (item.type === 'user') {
      return (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.id } })}
          style={styles.resultRow}
        >
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.resultAvatar} />
          ) : (
            <View style={[styles.resultAvatar, styles.avatarFallback]}>
              <Ionicons name="person" size={20} color="#888" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.resultTitle}>@{item.pseudo || 'utilisateur'}</Text>
            {item.nom ? <Text style={styles.resultSub}>{item.nom}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/post-detail', params: { postId: item.id } })}
        style={styles.resultRow}
      >
        <View style={styles.postThumb}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.postThumb} />
          ) : (
            <Ionicons name="document-text-outline" size={22} color="#888" />
          )}
        </View>
        <Text numberOfLines={2} style={[styles.resultSub, { flex: 1 }]}>
          {item.text || 'Publication'}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.title}>Découvrir</Text>
        <TouchableOpacity onPress={() => setOptionsVisible(true)} hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Rechercher un profil, #hashtag…"
          placeholderTextColor="#777"
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
        {search.length > 0 && !loading && (
          <TouchableOpacity onPress={() => { setSearch(''); setResults([]) }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {isSearching ? (
        results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderResult}
            contentContainerStyle={{ paddingTop: 8 }}
          />
        ) : !loading ? (
          <View style={styles.emptySearch}>
            <Ionicons name="search-outline" size={44} color="#555" />
            <Text style={styles.emptyText}>Aucun résultat pour "{search}"</Text>
          </View>
        ) : null
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingVertical: 16, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} tintColor={colors.primary} />
          }
        >
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

          <Text style={styles.sectionTitle}>Tendances au Gabon 🇬🇦</Text>
          {trendingLoading ? (
            <View style={{ padding: 20 }}><OrbitLoader /></View>
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
            <Text style={styles.emptyText}>Pas encore de tendances.</Text>
          )}

          <View style={{ marginTop: 20 }}>
            <SuggestionsSection
              title="Suggestions pour toi"
              suggestions={suggestions}
              loading={suggLoading}
              onDismiss={dismissSuggestion}
              error={suggError}
            />
          </View>

          {trending.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <SuggestionsSection
                title="Créateurs en vogue"
                suggestions={trending}
                compact
              />
            </View>
          )}
        </ScrollView>
      )}

      {optionsVisible && <Modal transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <TouchableOpacity style={styles.optionsBackdrop} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
          <View style={styles.optionsSheet}>
            {[
              { icon: 'refresh-outline', label: 'Actualiser', action: () => { setOptionsVisible(false); onRefreshAll() } },
              { icon: 'flag-outline', label: 'Signaler un problème', action: () => { setOptionsVisible(false); router.push('/settings') } },
              { icon: 'share-outline', label: "Partager l'app", action: () => { setOptionsVisible(false); Share.share({ message: 'Rejoins-moi sur Mbolo ! 🎉' }) } },
            ].map((item, i) => (
              <TouchableOpacity key={i} onPress={item.action} style={styles.optionRow}>
                <Ionicons name={item.icon as any} size={22} color="#fff" />
                <Text style={styles.optionLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  header: { height: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: '#1A1B1E' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#1E1F22' },
  resultAvatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: '#25272A', alignItems: 'center', justifyContent: 'center' },
  resultTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resultSub: { color: '#AAA', fontSize: 13, marginTop: 2 },
  postThumb: { width: 46, height: 46, borderRadius: 8, backgroundColor: '#1A1B1E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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
