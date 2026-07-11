import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors } from '../../src/lib/theme'
import { getTranslation } from '../../src/i18n/translations'
import { useTrendingHashtags } from '../../src/hooks/useTrendingHashtags'
import OrbitLoader from '../../src/components/OrbitLoader'

export default function Explore() {
  const [loading] = useState(false)
  const t = getTranslation('fr')
  const { tags: trendingTags } = useTrendingHashtags(8)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ marginRight: 8 }}>
            <Ionicons name="arrow-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', color: colors.white }}>
            {t.explore?.title || 'Découvrir'}
          </Text>
          <TouchableOpacity onPress={() => {}} hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <OrbitLoader size={80} />
          </View>
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
    </SafeAreaView>
  )
}
