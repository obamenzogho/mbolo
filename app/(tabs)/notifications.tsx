import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { batchFetchUsers } from '../../src/lib/firestore'
import { colors } from '../../src/lib/theme'
import QueryErrorMessage, { getIndexErrorMessage } from '../../src/components/ui/QueryErrorMessage'
import OrbitLoader from '../../src/components/OrbitLoader'
import type { Notification as NotificationType } from '../../src/types'

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationType[]>([])
  const [fromUserNames, setFromUserNames] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [ready, setReady] = useState(false)
  const userId = auth.currentUser?.uid

  const subscribe = useCallback(() => {
    if (!userId) return undefined
    setErrorMessage(null)
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(100)
    )
    const unsub = onSnapshot(q,
      async (snap: any) => {
        setErrorMessage(null)
        setReady(true)
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as NotificationType[]
        setNotifications(items)

        const fromUserIds = [...new Set(items.map((n) => n.fromUserId).filter(Boolean))]
        const unknownIds = fromUserIds.filter((id) => !fromUserNames[id])

        if (unknownIds.length > 0) {
          try {
            const userMap = await batchFetchUsers(unknownIds)
            const names: Record<string, string> = {}
            userMap.forEach((user, id) => {
              names[id] = user.nom || user.pseudo || 'Quelqu\'un'
            })
            setFromUserNames((prev) => ({ ...prev, ...names }))
          } catch {}
        }
      },
      (error: any) => {
        const msg = error?.code === 'failed-precondition'
          ? getIndexErrorMessage('failed-precondition')
          : 'Impossible de charger les notifications.'
        console.warn('[Firestore] notifications onError:', error?.code, error?.message)
        setErrorMessage(msg)
      },
    )
    return unsub
  }, [userId])

  useEffect(() => {
    const unsub = subscribe()
    return () => { if (unsub) unsub() }
  }, [subscribe, retryCount])

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1)
  }, [])

  const iconMap: Record<string, any> = {
    like: 'heart',
    comment: 'chatbubble',
    follow: 'person-add',
    follow_request: 'person-add',
    follow_accept: 'checkmark-circle',
    message: 'chatbubble-ellipses',
    repost: 'repeat',
  }

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white }}>Notifications</Text>
      </View>

      {errorMessage && (
        <QueryErrorMessage message={errorMessage} onRetry={handleRetry} />
      )}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="notifications-outline" size={64} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 16 }}>
              Aucune notification
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const name = fromUserNames[item.fromUserId] || 'Quelqu\'un'

          const content = (
            <View
              style={{
                backgroundColor: item.read ? colors.surface : colors.surfaceLight,
                padding: 14, borderRadius: 12, marginBottom: 8,
                borderWidth: 1, borderColor: colors.border,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <Ionicons
                name={iconMap[item.type] || 'notifications'}
                size={24}
                color={colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  {item.type === 'like' && `${name} a aimé ta vidéo`}
                  {item.type === 'comment' && `${name} a commenté ta vidéo`}
                  {item.type === 'follow' && `${name} a commencé à te suivre`}
                  {item.type === 'follow_request' && `${name} veut te suivre`}
                  {item.type === 'follow_accept' && `${name} a accepté ta demande`}
                  {item.type === 'message' && `${name} t'a envoyé un message`}
                </Text>
              </View>
            </View>
          )

          if (item.type === 'follow_request') {
            return (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/notifications/follow-requests')}
                activeOpacity={0.7}
              >
                {content}
              </TouchableOpacity>
            )
          }

          return content
        }}
      />
    </SafeAreaView>
  )
}
