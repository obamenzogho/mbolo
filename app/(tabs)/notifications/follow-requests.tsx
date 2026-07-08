import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, LayoutAnimation } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import * as Haptics from 'expo-haptics'
import { auth, db } from '../../../src/lib/firebase'
import { colors } from '../../../src/lib/theme'
import { Avatar } from '../../../src/components/ui/Avatar'
import OrbitLoader from '../../../src/components/OrbitLoader'
import { useFollow } from '../../../src/hooks/useFollow'
import { useGoBack } from '../../../src/hooks/useGoBack'
import { getOrCreateConversation } from '../../../src/features/chat/services/chatService'

interface PendingUser {
  id: string
  nom?: string
  pseudo: string
  photoURL?: string
}

export default function FollowRequests() {
  const userId = auth.currentUser?.uid
  const { goBack } = useGoBack()
  const { acceptFollowRequest, rejectFollowRequest } = useFollow(userId || '')
  const [users, setUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())

  const loadRequests = useCallback(async () => {
    if (!userId) return
    try {
      const snap = await getDoc(doc(db, 'users', userId))
      const pendingIds: string[] = snap.data()?.pendingFollowers || []
      if (pendingIds.length === 0) {
        setUsers([])
        return
      }
      const batch: PendingUser[] = []
      for (let i = 0; i < pendingIds.length; i += 30) {
        const chunk = pendingIds.slice(i, i + 30)
        const qSnap = await getDocs(
          query(collection(db, 'users'), where('__name__', 'in', chunk), limit(30)),
        )
        qSnap.docs.forEach((d: any) => {
          batch.push({ id: d.id, ...d.data() })
        })
      }
      setUsers(batch)
    } catch {}
  }, [userId])

  useEffect(() => {
    loadRequests().finally(() => setLoading(false))
  }, [loadRequests])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadRequests()
    setRefreshing(false)
  }, [loadRequests])

  const handleAccept = useCallback(async (fromUserId: string) => {
    await acceptFollowRequest(fromUserId)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setAcceptedIds((prev) => new Set(prev).add(fromUserId))
  }, [acceptFollowRequest])

  const handleReject = useCallback(async (fromUserId: string) => {
    await rejectFollowRequest(fromUserId)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setUsers((prev) => prev.filter((u) => u.id !== fromUserId))
  }, [rejectFollowRequest])

  const handleChat = useCallback(async (otherUserId: string) => {
    if (!userId) return
    const conv = await getOrCreateConversation(userId, otherUserId)
    router.push({
      pathname: '/(tabs)/messages/conversation/[id]',
      params: { id: conv.id },
    })
  }, [userId])

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={goBack} style={{ width: 36, height: 36, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <Text style={{ color: colors.white, fontSize: 22, fontWeight: '800' }}>
            Demandes de suivi
          </Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 36 }}>
          {users.length} demande{users.length !== 1 ? 's' : ''} en attente
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 16 }}>
              Aucune demande en attente
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isAccepted = acceptedIds.has(item.id)

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/user/${item.id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                marginBottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar
                uri={item.photoURL}
                name={item.nom || item.pseudo}
                size={56}
                borderWidth={isAccepted ? 0 : 2}
                borderColor={isAccepted ? 'transparent' : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700', lineHeight: 20 }}>
                  {item.nom || item.pseudo}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                  @{item.pseudo}
                </Text>
              </View>

              {isAccepted ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={{ color: colors.success, fontSize: 13, fontWeight: '600' }}>
                      Amis
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleChat(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primary + '20',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <TouchableOpacity
                    onPress={() => handleAccept(item.id)}
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 16,
                      paddingVertical: 7,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Accepter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleReject(item.id)}
                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Refuser</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </SafeAreaView>
  )
}
