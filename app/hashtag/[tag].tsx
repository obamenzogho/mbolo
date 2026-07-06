import { useState, useEffect } from 'react'
import { View, Text, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { colors } from '../../src/lib/theme'
import OrbitLoader from '../../src/components/OrbitLoader'
import { BackButton } from '../../src/components/ui/BackButton'

const { width } = Dimensions.get('window')
const COL = 3
const SIZE = width / COL

export default function HashtagPage() {
  const { tag } = useLocalSearchParams<{ tag: string }>()
  const [videos, setVideos] = useState<any[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tag) return
    ;(async () => {
      setLoading(true)
      const [vids, meta] = await Promise.all([getVideosByHashtag(tag), getHashtagMeta(tag)])
      setVideos(vids)
      setCount(meta?.videoCount ?? vids.length)
      setLoading(false)
    })()
  }, [tag])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <BackButton icon="arrow-back" size={24} color={colors.text} />
        <View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>#{tag}</Text>
          {count !== null && (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {count} video{count > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <OrbitLoader />
        </View>
      ) : (
        <FlatList
          data={videos}
          numColumns={COL}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/post', params: { id: item.id } })}
              style={{ width: SIZE, height: SIZE * 1.4 }}
            >
              <Image
                source={{ uri: item.thumbnailURL || item.videoURL }}
                style={{ flex: 1, margin: 1, backgroundColor: colors.surface }}
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
              Aucune video pour #{tag} pour l'instant
            </Text>
          }
        />
      )}
    </SafeAreaView>
  )
}
