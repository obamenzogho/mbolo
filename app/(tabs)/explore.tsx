import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image, Modal,
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
  const [optionsVisible, setOptionsVisible] = useState(false)
  const t = getTranslation('fr')
  const { tags: trendingTags } = useTrendingHashtags(8)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#111214' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ marginRight: 8 }}>
            <Ionicons name="arrow-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', color: colors.white }}>
            {t.explore?.title || 'Découvrir'}
          </Text>
          <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#292B2F', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.white} />
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

      <Modal transparent visible={optionsVisible} animationType="slide" onRequestClose={() => setOptionsVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => setOptionsVisible(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <View style={{ backgroundColor: '#1C1E22', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34 }}>
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3C42' }} />
            </View>
            {[
              { icon: 'flag-outline', label: 'Signaler', color: colors.white },
              { icon: 'share-outline', label: 'Partager', color: colors.white },
              { icon: 'information-circle-outline', label: 'À propos', color: colors.white },
            ].map((item, i) => (
              <TouchableOpacity key={i} onPress={() => setOptionsVisible(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 }}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
                <Text style={{ color: colors.white, fontSize: 15 }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
