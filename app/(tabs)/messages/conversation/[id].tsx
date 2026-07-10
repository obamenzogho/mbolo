import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { doc, getDoc } from 'firebase/firestore'
import * as Clipboard from 'expo-clipboard'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { colors } from '@/lib/theme'
import OrbitLoader from '@/components/OrbitLoader'
import { Avatar } from '@/components/ui/Avatar'
import { useGoBack } from '@/hooks/useGoBack'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useConversation } from '@/features/chat/hooks/useConversation'
import { useTypingIndicator } from '@/features/chat/hooks/useTypingIndicator'
import { useDraft } from '@/features/chat/hooks/useDraft'
import {
  sendMessage, markConversationAsRead,
  acceptConversation, blockConversation, deleteMessage,
} from '@/features/chat/services/chatService'
import { MessageBubble } from '@/features/chat/components/MessageBubble'
import { MessageInput } from '@/features/chat/components/MessageInput'
import BottomSheet from '@/components/ui/BottomSheet'
import type { User as UserType, Message } from '@/types'

export default function ConversationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { goBack } = useGoBack()
  const userId = auth.currentUser?.uid
  const { conversation, messages, loading } = useConversation(id)
  const [otherUser, setOtherUser] = useState<Pick<UserType, 'pseudo' | 'nom' | 'photoURL'> | null>(null)
  const otherId = conversation?.participants.find((p) => p !== userId) || null
  const otherOnline = useOnlineStatus(otherId)
  const { startTyping, stopTyping } = useTypingIndicator(id || null, userId || null)
  const { draft, setDraft, clearDraft } = useDraft(id || null)

  const otherTyping = otherId && conversation?.typingBy?.[otherId] ? true : false

  const isSpam = conversation?.spamFor?.includes(userId || '') ?? false
  const isBlocked = conversation?.blockedBy?.includes(userId || '') ?? false

  const [spamHandled, setSpamHandled] = useState(false)

  const handleAcceptSpam = useCallback(async () => {
    if (!id) return
    await acceptConversation(id, userId || '')
    setSpamHandled(true)
  }, [id, userId])

  const handleBlockSpam = useCallback(async () => {
    if (!id) return
    await blockConversation(id, userId || '')
    setSpamHandled(true)
  }, [id, userId])

  useEffect(() => {
    if (!conversation || !userId) return
    const oid = conversation.participants.find((p) => p !== userId)
    if (!oid) return
    getDoc(doc(db, 'users', oid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setOtherUser({ pseudo: data.pseudo, nom: data.nom, photoURL: data.photoURL })
      }
    })
  }, [conversation, userId])

  useEffect(() => {
    if (!id || !userId) return
    markConversationAsRead(id, userId)
  }, [id, userId, messages])

  const handleSend = useCallback((text: string) => {
    if (!id || !userId) return
    sendMessage(id, userId, text)
    stopTyping()
    clearDraft()
  }, [id, userId, stopTyping, clearDraft])

  const flatListRef = useRef<FlatList>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200)
    }
  }, [])

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => {
      if (messages.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150)
      }
    })
    return () => show.remove()
  }, [messages.length])

  const [contextMessage, setContextMessage] = useState<Message | null>(null)

  const handleMessageLongPress = useCallback((msg: Message) => {
    setContextMessage(msg)
  }, [])

  const handleCopyMessage = useCallback(async () => {
    if (!contextMessage) return
    await Clipboard.setStringAsync(contextMessage.text)
    setContextMessage(null)
  }, [contextMessage])

  const handleDeleteMessage = useCallback(() => {
    if (!contextMessage || !id) return
    Alert.alert('Supprimer', 'Supprimer ce message ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await deleteMessage(id, contextMessage.id)
          } catch (e) {
            captureException(e instanceof Error ? e : new Error(String(e)))
          }
          setContextMessage(null)
        },
      },
    ])
  }, [contextMessage, id])

  function getDateLabel(d: Date): string {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (dStart.getTime() === today.getTime()) return "Aujourd'hui"
    if (dStart.getTime() === yesterday.getTime()) return 'Hier'
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  type FlatItem = { key: string; isSeparator: true; label: string } | { key: string; isSeparator: false; message: (typeof messages)[number] }

  const flatData: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = []
    let lastLabel: string | null = null
    for (const msg of messages) {
      const date = msg.createdAt && typeof (msg.createdAt as any).toDate === 'function'
        ? (msg.createdAt as any).toDate() : new Date(msg.createdAt)
      const label = getDateLabel(date)
      if (label !== lastLabel) {
        items.push({ key: `sep-${msg.id}`, isSeparator: true, label })
        lastLabel = label
      }
      items.push({ key: msg.id, isSeparator: false, message: msg })
    }
    return items
  }, [messages])

  if (loading || !conversation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
        <TouchableOpacity onPress={goBack} style={{ width: 36, height: 36, justifyContent: 'center', marginRight: 4 }}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <View style={{ position: 'relative' }}>
          <Avatar uri={otherUser?.photoURL} name={otherUser?.nom || otherUser?.pseudo || ''} size={36} />
          {otherOnline && (
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34b7f1', borderWidth: 2, borderColor: '#000' }} />
          )}
        </View>
        <View style={{ marginLeft: 10 }}>
          <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700' }}>
            {otherUser?.nom || otherUser?.pseudo || '...'}
          </Text>
          {otherTyping ? (
            <Text style={{ color: '#34b7f1', fontSize: 12, fontStyle: 'italic' }}>Écrit...</Text>
          ) : otherUser?.pseudo && otherUser?.nom ? (
            <Text style={{ color: '#888', fontSize: 12 }}>@{otherUser.pseudo}</Text>
          ) : null}
        </View>
      </View>

      {isSpam && !spamHandled && (
        <View style={{ marginHorizontal: 12, marginTop: 8, padding: 12, backgroundColor: '#1a1a2e', borderRadius: 10, borderWidth: 1, borderColor: '#333' }}>
          <Text style={{ color: colors.white, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Message masqué</Text>
          <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 10 }}>
            Cet utilisateur ne fait pas partie de vos abonnements.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleAcceptSpam}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>OK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBlockSpam}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: '#222', borderWidth: 1, borderColor: '#444', alignItems: 'center' }}
            >
              <Text style={{ color: '#ff4444', fontSize: 13, fontWeight: '600' }}>Bloquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isBlocked && (
        <View style={{ marginHorizontal: 12, marginTop: 8, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 10, alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 13 }}>Conversation bloquée</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <FlatList
        ref={flatListRef}
        data={flatData}
        keyExtractor={(item) => item.key}
        inverted={false}
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => {
          if (isNearBottom) flatListRef.current?.scrollToEnd({ animated: true })
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
          setIsNearBottom(contentOffset.y + layoutMeasurement.height >= contentSize.height - 50)
        }}
        scrollEventThrottle={100}
        renderItem={({ item }) => {
          if (item.isSeparator) {
            return (
              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 5, backgroundColor: '#222', borderRadius: 12 }}>
                  <Text style={{ color: '#888', fontSize: 12, fontWeight: '500' }}>{item.label}</Text>
                </View>
              </View>
            )
          }
          const msg = item.message
          const lastRead = conversation?.lastReadAt?.[otherId || '']
          const msgDate = msg.createdAt && typeof (msg.createdAt as any).toDate === 'function'
            ? (msg.createdAt as any).toDate() : new Date(msg.createdAt)
          const lastReadDate = lastRead && typeof (lastRead as any).toDate === 'function'
            ? (lastRead as any).toDate() : new Date(lastRead)
          const isRead = !!(lastRead && msg.createdAt && msgDate.getTime() <= lastReadDate.getTime())
          return (
            <MessageBubble
              text={msg.text}
              isMine={msg.senderId === userId}
              createdAt={msg.createdAt}
              read={isRead}
              type={msg.type}
              storyRef={msg.storyRef}
              onLongPress={() => handleMessageLongPress(msg)}
            />
          )
        }}
      />

      {!isBlocked && (
        <MessageInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text)
            if (text.trim()) startTyping()
            else stopTyping()
          }}
          onSend={handleSend}
        />
      )}

      {contextMessage && (
        <BottomSheet visible onClose={() => setContextMessage(null)} height="auto" containerStyle={{ paddingBottom: 34 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
            <Text numberOfLines={1} style={{ color: '#888', fontSize: 12 }}>{contextMessage.text}</Text>
          </View>
          <View style={{ height: 0.5, backgroundColor: '#333', marginBottom: 4 }} />

          <TouchableOpacity onPress={handleCopyMessage} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 14 }}>
            <Ionicons name="copy-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16 }}>Copier</Text>
          </TouchableOpacity>

          {contextMessage.senderId === userId && (
            <TouchableOpacity onPress={handleDeleteMessage} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 14 }}>
              <Ionicons name="trash-outline" size={22} color="#ff4444" />
              <Text style={{ color: '#ff4444', fontSize: 16 }}>Supprimer</Text>
            </TouchableOpacity>
          )}
        </BottomSheet>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
