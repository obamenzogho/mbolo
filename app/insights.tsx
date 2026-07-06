import { View, Text, ScrollView, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth } from '../src/lib/firebase'
import { useCreatorInsights } from '../src/hooks/useCreatorInsights'
import { colors } from '../src/lib/theme'
import OrbitLoader from '../src/components/OrbitLoader'
import { BackButton } from '../src/components/ui/BackButton'

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center' }}>
    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
      {value >= 1000 ? (value / 1000).toFixed(1) + 'K' : value}
    </Text>
    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{label}</Text>
  </View>
)

export default function Insights() {
  const uid = auth.currentUser?.uid ?? ''
  const { insights, loading } = useCreatorInsights(uid)

  if (loading || !insights) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <OrbitLoader />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <BackButton />
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Statistiques</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatCard label="Vues" value={insights.totalViews} />
          <StatCard label="J'aime" value={insights.totalLikes} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatCard label="Commentaires" value={insights.totalComments} />
          <StatCard label="Partages" value={insights.totalShares} />
        </View>

        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 }}>
          Tes vidéos les plus vues
        </Text>
        {insights.topVideos.map((v, i) => (
          <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 10 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '700', width: 20 }}>{i + 1}</Text>
            <Image source={{ uri: v.thumbnailURL }} style={{ width: 44, height: 60, borderRadius: 6, backgroundColor: colors.surfaceLight }} />
            <View>
              <Text style={{ color: colors.text }}>{v.views.toLocaleString()} vues</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{v.likes.toLocaleString()} j'aime</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
