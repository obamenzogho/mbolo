import { useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db, auth } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { getTranslation } from '../../src/i18n/translations'
import { useTrendingHashtags } from '../../src/hooks/useTrendingHashtags'
import { getVideosByHashtag } from '../../src/services/hashtagService'
import OrbitLoader from '../../src/components/OrbitLoader'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface SearchResult {
  id: string
  type: 'user' | 'video'
  nom?: string
  pseudo?: string
  photoURL?: string
  description?: string
  videoURL?: string
}

export default function Explore() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = getTranslation('fr')
  const { tags: trendingTags } = useTrendingHashtags(8)

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    setLoading(true)
    try {
      const resultsArr: SearchResult[] = []

      const termLower = term.trim().toLowerCase()
      const usersQ = query(
        collection(db, 'users'),
        where('pseudoLower', '>=', termLower),
        where('pseudoLower', '<=', termLower + '\uf8ff'),
        limit(10)
      )
      const usersSnap = await getDocs(usersQ)
      for (const doc of usersSnap.docs) {
        const data = doc.data()
        resultsArr.push({
          id: doc.id,
          type: 'user',
          nom: data.nom,
          pseudo: data.pseudo,
          photoURL: data.photoURL,
        })
      }

      if (term.startsWith('#')) {
        const vids = await getVideosByHashtag(term)
        for (const v of vids) {
          resultsArr.push({
            id: v.id,
            type: 'video',
            description: v.description,
            videoURL: v.videoURL,
          })
        }
      }

      setResults(resultsArr)
    } catch (e) {
      console.error('Search error:', e)
    }
    setLoading(false)
    setSearching(false)
  }, [])

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!text.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    searchTimeout.current = setTimeout(() => performSearch(text), 400)
  }, [performSearch])

  const handleTagPress = (tag: string) => {
    setSearch(tag)
    setSearching(true)
    searchTimeout.current = setTimeout(() => performSearch(tag), 100)
  }

  const renderUserResult = (item: SearchResult) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#333', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={{ width: 48, height: 48 }} />
        ) : (
          <Ionicons name="person" size={24} color="#666" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>@{item.pseudo || 'utilisateur'}</Text>
        {item.nom ? <Text style={{ color: '#888', fontSize: 13, marginTop: 1 }}>{item.nom}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#444" />
    </TouchableOpacity>
  )

  const renderVideoResult = (item: SearchResult) => (
    <TouchableOpacity
      onPress={() => {}}
      style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, gap: 12, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#222' }}
    >
      <View style={{ width: 60, height: 80, borderRadius: 8, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }}>
        {item.videoURL ? (
          <Ionicons name="film" size={24} color="#444" />
        ) : (
          <Ionicons name="videocam" size={24} color="#444" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.white, fontSize: 14, fontWeight: '500' }} numberOfLines={2}>
          {item.description || 'Vidéo sans description'}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const renderResult = ({ item }: { item: SearchResult }) => {
    if (item.type === 'user') return renderUserResult(item)
    return renderVideoResult(item)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white, marginBottom: 16 }}>
          {t.explore?.title || 'Découvrir'}
        </Text>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12, paddingHorizontal: 16,
            borderWidth: 1, borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={handleSearchChange}
            placeholder="Rechercher utilisateurs, hashtags..."
            placeholderTextColor={colors.textSecondary}
            style={{ flex: 1, color: colors.text, padding: 12, fontSize: 16 }}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
          {search.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setSearch(''); setResults([]); setSearching(false) }} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderResult}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 8 }}
          ListEmptyComponent={
            loading ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <OrbitLoader size={80} />
              </View>
            ) : null
          }
        />
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              {t.explore?.trending || 'Tendances au Gabon'} 🇬🇦
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {trendingTags.map((t) => (
                <TouchableOpacity
                  key={t.tag}
                  onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: t.tag } })}
                  style={{
                    backgroundColor: colors.surfaceLight,
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>#{t.tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Artistes gabonais
            </Text>
            {loading ? (
              <OrbitLoader size={80} />
            ) : (
              <FlatList
                horizontal
                data={[1, 2, 3, 4, 5]}
                keyExtractor={(i) => i.toString()}
                renderItem={() => (
                  <TouchableOpacity style={{ width: 120, marginRight: 12, alignItems: 'center' }}>
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primary }}>
                      <Ionicons name="person" size={40} color={colors.textSecondary} />
                    </View>
                    <Text style={{ color: colors.white, marginTop: 8, fontSize: 13, textAlign: 'center' }} numberOfLines={1}>Artiste</Text>
                  </TouchableOpacity>
                )}
                showsHorizontalScrollIndicator={false}
              />
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  )
}
