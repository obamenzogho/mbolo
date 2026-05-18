import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import type { Notification } from '../../src/types'

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const userId = auth.currentUser?.uid

  useEffect(() => {
    if (!userId) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Notification[]
      setNotifications(items)
    })
    return unsub
  }, [userId])

  const iconMap: Record<string, any> = {
    like: 'heart',
    comment: 'chatbubble',
    follow: 'person-add',
    message: 'chatbubble-ellipses',
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white }}>Notifications</Text>
      </View>

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
        renderItem={({ item }) => (
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
                {item.type === 'like' && "Quelqu'un a aimé ta vidéo"}
                {item.type === 'comment' && "Quelqu'un a commenté ta vidéo"}
                {item.type === 'follow' && "Quelqu'un a commencé à te suivre"}
                {item.type === 'message' && 'Tu as reçu un message'}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  )
}
