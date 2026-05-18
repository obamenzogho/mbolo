import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  collection, query, where, onSnapshot,
  addDoc, serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import type { Message } from '../../src/types'

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const userId = auth.currentUser?.uid

  useEffect(() => {
    if (!userId) return
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', userId),
    )
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]
      items.sort((a, b) => {
        const ta = (a.createdAt as any)?.toMillis?.() ?? 0
        const tb = (b.createdAt as any)?.toMillis?.() ?? 0
        return tb - ta
      })
      setMessages(items)
    })
    return unsub
  }, [userId])

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId) return
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: userId,
        participants: [userId],
        text: newMessage.trim(),
        createdAt: serverTimestamp(),
        read: false,
      })
      setNewMessage('')
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text
          style={{
            fontSize: 28, fontWeight: '800', color: colors.white,
            marginBottom: 16,
          }}
        >
          Messages
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 16 }}>
              Aucun message
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: colors.surface,
              padding: 12, borderRadius: 12, marginBottom: 8,
              borderWidth: 1, borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15 }}>{item.text}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
              {item.createdAt?.toString()}
            </Text>
          </View>
        )}
      />

      <View
        style={{
          flexDirection: 'row', padding: 12, borderTopWidth: 1,
          borderTopColor: colors.border, backgroundColor: colors.surface,
          gap: 8,
        }}
      >
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Écris un message..."
          placeholderTextColor={colors.textSecondary}
          style={{
            flex: 1, backgroundColor: colors.background,
            color: colors.text, borderRadius: 20, paddingHorizontal: 16,
            paddingVertical: 10, fontSize: 15,
            borderWidth: 1, borderColor: colors.border,
          }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={{
            backgroundColor: colors.primary,
            width: 40, height: 40, borderRadius: 20,
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
