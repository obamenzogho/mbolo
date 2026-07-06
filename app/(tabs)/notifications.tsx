import { useState, useEffect, useCallback } from 'react'
import { View, Text, SectionList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { batchFetchUsers } from '../../src/lib/firestore'
import { colors } from '../../src/lib/theme'
import QueryErrorMessage, { getIndexErrorMessage } from '../../src/components/ui/QueryErrorMessage'
import OrbitLoader from '../../src/components/OrbitLoader'
import { markAllNotificationsRead, markNotificationRead } from '../../src/services/notificationActions'
import { groupByTime } from '../../src/lib/notificationGroups'
import type { Notification as NotificationType } from '../../src/types'

const iconMap: Record<string, any> = {
  like: 'heart',
  comment: 'chatbubble',
  follow: 'person-add',
  follow_request: 'person-add',
  follow_accept: 'checkmark-circle',
  message: 'chatbubble-ellipses',
  repost: 'repeat',
  tag: 'pricetag',
  mention: 'at',
}

const handleNotifPress = (item: NotificationType) => {
  markNotificationRead(item.id)
  switch (item.type) {
    case 'follow':
    case 'follow_accept':
      router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.fromUserId } })
      break
    case 'follow_request':
      router.push('/(tabs)/notifications/follow-requests')
      break
    case 'like':
    case 'comment':
    case 'reply':
    case 'repost':
    case 'tag':
    case 'mention':
      if (item.videoId) router.push({ pathname: '/post', params: { id: item.videoId } })
      break
    case 'message':
      router.push('/(tabs)/messages')
      break
  }
}

const messageForType = (type: string, name: string) => {
  switch (type) {
    case 'like': return `${name} a aimé ta vidéo`
    case 'comment': return `${name} a commenté ta vidéo`
    case 'follow': return `${name} a commencé à te suivre`
    case 'follow_request': return `${name} veut te suivre`
    case 'follow_accept': return `${name} a accepté ta demande`
    case 'message': return `${name} t'a envoyé un message`
    case 'repost': return `${name} a republié ta vidéo`
    case 'tag': return `${name} t'a identifié dans une vidéo`
    case 'mention': return `${name} t'a mentionné`
    default: return ''
  }
}

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

  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => markAllNotificationsRead(), 1500)
    return () => clearTimeout(t)
  }, []))

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1)
  }, [])

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  const sections = groupByTime(notifications)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white }}>Notifications</Text>
      </View>

      {errorMessage && (
        <QueryErrorMessage message={errorMessage} onRetry={handleRetry} />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 }}>
            {section.title}
          </Text>
        )}
        contentContainerStyle={{ padding: 8, paddingBottom: 80 }}
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

          return (
            <TouchableOpacity onPress={() => handleNotifPress(item)} activeOpacity={0.7}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
                backgroundColor: item.read ? 'transparent' : 'rgba(0,200,83,0.08)',
              }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={iconMap[item.type] || 'notifications'} size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>
                  {messageForType(item.type, name)}
                </Text>
                {!item.read && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                )}
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </SafeAreaView>
  )
}
