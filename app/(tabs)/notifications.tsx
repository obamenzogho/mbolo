import { useState, useEffect, useCallback } from 'react'
import { View, Text, SectionList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { collection, query, where, orderBy, onSnapshot, limit, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { batchFetchUsers } from '../../src/lib/firestore'
import { colors } from '../../src/lib/theme'
import QueryErrorMessage, { getIndexErrorMessage } from '../../src/components/ui/QueryErrorMessage'
import OrbitLoader from '../../src/components/OrbitLoader'
import { NotificationRow } from '../../src/components/notifications/NotificationRow'
import { markAsRead, markAllAsRead } from '../../src/services/notificationRead'
import notificationService from '../../src/services/notificationService'
import { groupByTime } from '../../src/lib/notificationGroups'
import type { Notification as NotificationType } from '../../src/types'
import { useSettings } from '../../src/features/settings/SettingsProvider'

// Mappe un type de notification vers la catégorie de réglage qui la contrôle.
// Quand l'utilisateur désactive une catégorie, les notifs correspondantes sont
// masquées de la liste (filtrage côté client). Le filtrage côté push (serveur)
// est assuré par la Cloud Function onNotificationCreate.
const NOTIF_CATEGORY: Record<NotificationType['type'], keyof ReturnType<typeof useSettings>['settings']['notifications']> = {
  like: 'likes',
  post_like: 'likes',
  comment: 'comments',
  post_comment: 'comments',
  post_repost: 'reposts',
  reply: 'comments',
  follow: 'follows',
  follow_request: 'follows',
  follow_accept: 'follows',
  mention: 'mentions',
  tag: 'mentions',
  repost: 'reposts',
  message: 'messages',
  share: 'reposts',
}

const handleNotifPress = (item: NotificationType) => {
  markAsRead(item.id)
  switch (item.type) {
    case 'follow':
    case 'follow_accept':
      router.push({ pathname: '/(tabs)/(sub)/user/[userId]', params: { userId: item.fromUserId } })
      break
    case 'follow_request':
      router.push('/follow-requests')
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
    case 'post_like':
    case 'post_comment':
      if (item.postId) router.push({ pathname: '/post-detail', params: { postId: item.postId } })
      break
  }
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationType[]>([])
  const [actors, setActors] = useState<Record<string, { name: string; avatar?: string }>>({})
  const [videoThumbs, setVideoThumbs] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [ready, setReady] = useState(false)
  const userId = auth.currentUser?.uid
  const { settings } = useSettings()
  const nSettings = settings.notifications

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

        const unreadCount = items.filter((n: any) => n.read === false).length
        notificationService.setBadgeCount(unreadCount).catch(() => {})

        const fromUserIds = [...new Set(items.map((n) => n.fromUserId).filter(Boolean))]
        const unknownActors = fromUserIds.filter((id) => !actors[id])

        if (unknownActors.length > 0) {
          try {
            const userMap = await batchFetchUsers(unknownActors)
            const next: Record<string, { name: string; avatar?: string }> = {}
            userMap.forEach((u, id) => {
              next[id] = { name: u.nom || u.pseudo || 'Quelqu\'un', avatar: u.photoURL }
            })
            setActors((prev) => ({ ...prev, ...next }))
          } catch {}
        }

        const videoIds = [...new Set(items.map((n: any) => n.videoId || n.postId).filter(Boolean))]
        const unknownVids = videoIds.filter((id) => !videoThumbs[id])
        if (unknownVids.length > 0) {
          try {
            const results = await Promise.allSettled(unknownVids.map((id: string) => getDoc(doc(db, 'videos', id))))
            const next: Record<string, string> = {}
            results.forEach((r, i) => {
              if (r.status === 'fulfilled' && r.value.exists()) {
                const d = r.value.data() as any
                next[unknownVids[i]] = d.thumbnailURL || d.coverURL || ''
              }
            })
            setVideoThumbs((prev) => ({ ...prev, ...next }))
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
    const t = setTimeout(() => userId && markAllAsRead(userId), 1500)
    return () => clearTimeout(t)
  }, [userId]))

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

  // Filtrage par catégorie selon les réglages de l'utilisateur. Si l'interrupteur
  // maître est coupé, tout est masqué ; sinon chaque catégorie cache sa notif.
  const visibleNotifications = notifications.filter((notif) => {
    if (!nSettings.enabled) return false
    const cat = NOTIF_CATEGORY[notif.type]
    if (!cat) return true
    return nSettings[cat] !== false
  })

  const sections = groupByTime(visibleNotifications)
  const hasUnread = visibleNotifications.some((n: any) => n.read === false)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white }}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity onPress={() => userId && markAllAsRead(userId)} style={{ padding: 6 }}>
            <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '600' }}>
              Tout marquer comme lu
            </Text>
          </TouchableOpacity>
        )}
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
          const actor = actors[item.fromUserId] ?? { name: 'Quelqu\'un' }
          const vidId = (item as any).videoId || (item as any).postId
          return (
            <NotificationRow
              item={item}
              actorName={actor.name}
              actorAvatar={actor.avatar}
              videoThumb={vidId ? videoThumbs[vidId] : undefined}
              onPressActor={() => router.push({ pathname: '/(tabs)/(sub)/user/[userId]', params: { userId: item.fromUserId } })}
              onPress={() => handleNotifPress(item)}
            />
          )
        }}
      />
    </SafeAreaView>
  )
}
