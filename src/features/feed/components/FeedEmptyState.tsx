import { useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { colors } from '../../../lib/theme'
import OrbitLoader from '../../../components/OrbitLoader'
import FollowButton from '../../../components/FollowButton'
import { Avatar } from '../../../components/ui/Avatar'
import PageWrapper from '../../../components/PageWrapper'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { FeedMode } from '../hooks/useVideoFeed'
import type { User } from '../../../types'

export function FeedPourtoiEmpty({ feedMode, setFeedMode }: {
  feedMode: FeedMode; setFeedMode: (m: FeedMode) => void
}) {
  return (
    <PageWrapper type="fade" style={{ backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <OrbitLoader size={80} />
          <Text style={{ color: colors.textSecondary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
            Aucune vidéo{'\n'}Sois le premier à poster
          </Text>
        </SafeAreaView>
      </View>
    </PageWrapper>
  )
}

export function FeedSuiviEmpty({ feedMode, setFeedMode, suggestedUsers, suggestionsLoading }: {
  feedMode: FeedMode; setFeedMode: (m: FeedMode) => void
  suggestedUsers: User[]; suggestionsLoading: boolean
}) {
  const scrollRef = useRef<ScrollView>(null)

  return (
    <PageWrapper type="fade" style={{ backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ paddingTop: 90, paddingBottom: 40 }}>
            <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
              <OrbitLoader size={80} />
              <Text style={{ color: colors.textSecondary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
                Tu ne suis personne encore
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                Explore pour trouver des créateurs
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 24,
                  paddingVertical: 10, borderRadius: 8,
                }}
                onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>
                  Commencer à suivre
                </Text>
              </TouchableOpacity>
            </View>
            {!suggestionsLoading && suggestedUsers.length > 0 && (
              <View style={{ marginTop: 40, paddingLeft: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>
                  Suggestions
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 16 }}>
                  {suggestedUsers.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: user.id } })}
                      style={{ alignItems: 'center', width: 84, height: 125 }}
                    >
                      <Avatar
                        uri={user.photoURL}
                        name={user.nom || user.pseudo}
                        size={72}
                        borderWidth={2}
                        borderColor={colors.primary}
                      />
                      <Text numberOfLines={1} style={{ color: colors.white, fontSize: 12, marginTop: 6, textAlign: 'center', height: 16, lineHeight: 16 }}>
                        {user.nom || user.pseudo}
                      </Text>
                      <FollowButton targetUserId={user.id} size="sm" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </PageWrapper>
  )
}
