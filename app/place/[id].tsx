import { useState, useEffect } from 'react'
import { View, Text, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { colors } from '../../src/lib/theme'
import { db } from '../../src/lib/firebase'
import OrbitLoader from '../../src/components/OrbitLoader'
import { BackButton } from '../../src/components/ui/BackButton'

const { width } = Dimensions.get('window')
const COL = 3
const SIZE = width / COL

export default function PlacePage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const snap = await getDocs(query(
          collection(db, 'videos'),
          where('place', '==', id),
          orderBy('createdAt', 'desc'),
          limit(50),
        ))
        setVideos(snap.docs.map((d: any) => ({ id: d.id, ...d.data() as any })))
      } catch {}
      setLoading(false)
    })()
  }, [id])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <BackButton icon="arrow-back" size={24} color={colors.text} />
        <View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{id}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {videos.length} vidéo{videos.length !== 1 ? 's' : ''}
          </Text>
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
              Aucune vidéo pour {id} pour l'instant
            </Text>
          }
        />
      )}
    </SafeAreaView>
  )
}
