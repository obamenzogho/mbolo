import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { searchAll, type SearchResults } from '../src/services/searchService'
import { colors } from '../src/lib/theme'
import OrbitLoader from '../src/components/OrbitLoader'
import { BackButton } from '../src/components/ui/BackButton'

const RECENT_KEY = 'mbolo_recent_searches'
const MAX_RECENT = 8

export default function Search() {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<SearchResults>({ users: [], hashtags: [], videos: [] })
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((v) => {
      if (v) setRecent(JSON.parse(v))
    })
  }, [])

  const saveRecent = useCallback(async (q: string) => {
    const clean = q.trim()
    if (!clean) return
    const next = [clean, ...recent.filter((r) => r !== clean)].slice(0, MAX_RECENT)
    setRecent(next)
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }, [recent])

  const clearRecent = useCallback(async () => {
    setRecent([])
    await AsyncStorage.removeItem(RECENT_KEY)
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ users: [], hashtags: [], videos: [] }); return }
    setLoading(true)
    const res = await searchAll(q)
    setResults(res)
    setLoading(false)
  }, [])

  const onType = (t: string) => {
    setTerm(t)
    if (timer.current) clearTimeout(timer.current)
    if (!t.trim()) { setResults({ users: [], hashtags: [], videos: [] }); return }
    timer.current = setTimeout(() => runSearch(t), 350)
  }

  const openUser = (id: string, pseudo: string) => {
    saveRecent(pseudo)
    Keyboard.dismiss()
    router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: id } })
  }

  const openHashtag = (tag: string) => {
    saveRecent('#' + tag)
    Keyboard.dismiss()
    router.push({ pathname: '/hashtag/[tag]', params: { tag } })
  }

  const hasResults = results.users.length > 0 || results.hashtags.length > 0 || results.videos.length > 0
  const showRecent = !term.trim() && recent.length > 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <BackButton icon="arrow-back" size={24} color={colors.text} />
        
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={term}
            onChangeText={onType}
            placeholder="Rechercher un pseudo, #hashtag..."
            placeholderTextColor={colors.textSecondary}
            autoFocus
            autoCapitalize="none"
            style={{ flex: 1, color: colors.text, paddingVertical: 10, paddingHorizontal: 8 }}
          />
          {term.length > 0 && (
            <TouchableOpacity onPress={() => onType('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <OrbitLoader />
        </View>
      )}

      {showRecent && (
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Recherches récentes</Text>
            <TouchableOpacity onPress={clearRecent}>
              <Text style={{ color: colors.primary, fontSize: 13 }}>Effacer</Text>
            </TouchableOpacity>
          </View>
          {recent.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => { setTerm(r); runSearch(r) }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
            >
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={{ color: colors.text, flex: 1 }}>{r}</Text>
              <Ionicons name="arrow-up-outline" size={16} color={colors.textSecondary} style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!loading && term.trim() !== '' && (
        <FlatList
          data={[]}
          renderItem={null}
          keyExtractor={() => 'x'}
          ListHeaderComponent={
            <View>
              {results.hashtags.map((h) => (
                <TouchableOpacity
                  key={'tag-' + h.tag}
                  onPress={() => openHashtag(h.tag)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="pricetag" size={20} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>#{h.tag}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{h.videoCount} vidéo{h.videoCount > 1 ? 's' : ''}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {results.users.map((u) => (
                <TouchableOpacity
                  key={'user-' + u.id}
                  onPress={() => openUser(u.id, u.pseudo)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}
                >
                  <Image source={{ uri: u.photoURL }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceLight }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>@{u.pseudo}</Text>
                      {u.verified && <Ionicons name="checkmark-circle" size={14} color="#3897f0" style={{ marginLeft: 4 }} />}
                    </View>
                    {u.nom ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{u.nom}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}

              {results.videos.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 1 }}>
                  {results.videos.map((v: any) => (
                    <TouchableOpacity
                      key={'vid-' + v.id}
                      onPress={() => router.push({ pathname: '/post', params: { id: v.id } })}
                      style={{ width: '33%', aspectRatio: 0.7, padding: 1 }}
                    >
                      <Image source={{ uri: v.thumbnailURL || v.videoURL }} style={{ flex: 1, backgroundColor: colors.surface }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!hasResults && (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
                  Aucun résultat pour "{term}"
                </Text>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
