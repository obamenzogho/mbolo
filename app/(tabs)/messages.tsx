import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  collection, query, where, getDocs, limit,
} from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import OrbitLoader from '../../src/components/OrbitLoader'
import { useConversations } from '@/features/chat/hooks/useConversations'
import {
  getOrCreateConversation,
  pinConversation, unpinConversation,
  muteConversation, unmuteConversation,
  markConversationAsRead, markConversationAsUnread,
  deleteConversation, unarchiveConversation, blockConversation,
} from '@/features/chat/services/chatService'
import { ConversationItem } from '@/features/chat/components/ConversationItem'
import { NewConversationModal } from '@/features/chat/components/NewConversationModal'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Conversation } from '@/types'
import BottomSheet from '../../src/components/ui/BottomSheet'

function ConversationItemWithStatus({ item, otherId, otherUser, ...rest }: {
  item: Conversation; otherId: string | undefined; otherUser: { pseudo: string; nom?: string; photoURL?: string }
  unread: boolean; pinned: boolean; muted: boolean; deliveryStatus?: 'sent' | 'delivered' | 'read'
  selectable: boolean; selected: boolean
  onSelectToggle: () => void; onPress: () => void; onLongPress: () => void; onSwipeDelete: () => void
  swipeIcon?: string; swipeLabel?: string; swipeColor?: string
}) {
  const online = useOnlineStatus(otherId)
  const typing = otherId ? !!(
    item.typingBy?.[otherId]
  ) : false
  return (
    <ConversationItem
      pseudo={otherUser.pseudo || ''}
      nom={otherUser.nom}
      photoURL={otherUser.photoURL}
      lastMessage={item.lastMessage?.text}
      lastMessageAt={item.lastMessage?.createdAt ?? null}
      unread={rest.unread}
      pinned={rest.pinned}
      muted={rest.muted}
      online={online}
      typing={typing}
      deliveryStatus={rest.deliveryStatus}
      selectable={rest.selectable}
      selected={rest.selected}
      onSelectToggle={rest.onSelectToggle}
      onPress={rest.onPress}
      onLongPress={rest.onLongPress}
      onSwipeDelete={rest.onSwipeDelete}
      swipeIcon={rest.swipeIcon}
      swipeLabel={rest.swipeLabel}
      swipeColor={rest.swipeColor}
    />
  )
}

function MenuRow({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 14 }}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={{ color, fontSize: 16 }}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function Messages() {
  const userId = auth.currentUser?.uid
  const { normal, spam, archived, loading } = useConversations(userId)
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages')
  const [usersMap, setUsersMap] = useState<Record<string, { pseudo: string; nom?: string; photoURL?: string }>>({})
  const [modalVisible, setModalVisible] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [filterMenuVisible, setFilterMenuVisible] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [menuConv, setMenuConv] = useState<Conversation | null>(null)

  const allConvs = [...normal, ...spam, ...archived]

  const filteredList = useMemo(() => {
    let list: Conversation[]

    if (showArchived) {
      list = archived
    } else {
      list = activeTab === 'messages' ? normal : spam
    }

    if (filterMode === 'unread') {
      list = list.filter((item) => {
        const lastReadAt = item.lastReadAt?.[userId || '']
        const lastMsgAt = item.lastMessage?.createdAt
        return lastMsgAt && lastReadAt
          ? new Date(lastMsgAt).getTime() > new Date(lastReadAt).getTime()
          : false
      })
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((item: Conversation) => {
        const otherId = item.participants.find((p) => p !== userId)
        const otherUser = otherId ? usersMap[otherId] : null
        if (!otherUser) return false
        return (otherUser.nom || '').toLowerCase().includes(q) ||
               (otherUser.pseudo || '').toLowerCase().includes(q)
      })
    }

    return list.sort((a, b) => {
      const aPinned = a.pinnedBy?.includes(userId || '') ?? false
      const bPinned = b.pinnedBy?.includes(userId || '') ?? false
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return 0
    })
  }, [activeTab, normal, spam, archived, showArchived, filterMode, searchQuery, userId, usersMap])

  const unreadCounts = useMemo(() => {
    const calc = (list: Conversation[]) =>
      list.filter((item) => {
        const lastReadAt = item.lastReadAt?.[userId || '']
        const lastMsgAt = item.lastMessage?.createdAt
        return lastMsgAt && lastReadAt
          ? new Date(lastMsgAt).getTime() > new Date(lastReadAt).getTime()
          : false
      }).length
    return { normalUnread: calc(normal), spamUnread: calc(spam) }
  }, [normal, spam, userId])

  useEffect(() => {
    if (!userId || allConvs.length === 0) return
    const otherIds = allConvs
      .map((c) => c.participants.find((p) => p !== userId))
      .filter(Boolean) as string[]
    const uniqueIds = [...new Set(otherIds)]
    const existing = Object.keys(usersMap)
    const toFetch = uniqueIds.filter((id) => !existing.includes(id))
    if (toFetch.length === 0) return

    const fetchUsers = async () => {
      const batch: Record<string, any> = {}
      for (let i = 0; i < toFetch.length; i += 30) {
        const chunk = toFetch.slice(i, i + 30)
        const snap = await getDocs(
          query(collection(db, 'users'), where('__name__', 'in', chunk), limit(30)),
        )
        snap.docs.forEach((d: any) => {
          batch[d.id] = d.data()
        })
      }
      setUsersMap((prev) => ({ ...prev, ...batch }))
    }
    fetchUsers()
  }, [normal, spam, archived, userId])

  const handleSelectUser = useCallback(async (otherUserId: string) => {
    if (!userId) return
    const conv = await getOrCreateConversation(userId, otherUserId)
    router.push({
      pathname: '/(tabs)/messages/conversation/[id]',
      params: { id: conv.id },
    })
  }, [userId])

  const handleOpenConversation = useCallback((conversationId: string) => {
    router.push({
      pathname: '/(tabs)/messages/conversation/[id]',
      params: { id: conversationId },
    })
  }, [])

  const enterSelectMode = useCallback((id: string) => {
    setSearchOpen(false)
    setSelectMode(true)
    setSelectedIds(new Set([id]))
  }, [])

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      if (next.size === 0) {
        setSelectMode(false)
      }
      return next
    })
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const closeModal = useCallback(() => setMenuConv(null), [])

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {selectMode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.white }}>
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={async () => {
                  if (!userId) return
                  await Promise.all(Array.from(selectedIds).map((id) => deleteConversation(id, userId)))
                  exitSelectMode()
                }}
                style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="trash-outline" size={22} color="#ff4444" />
              </TouchableOpacity>
              <TouchableOpacity onPress={exitSelectMode} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={24} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white }}>
              Messages
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="pencil" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {!selectMode && (
        <View style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'center' }}>
          {searchOpen ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher..."
                placeholderTextColor="#555"
                autoFocus
                style={{
                  flex: 1, backgroundColor: '#1a1a1a', color: colors.white,
                  borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
                }}
              />
              <TouchableOpacity onPress={() => {
                if (searchQuery.length > 0) {
                  setSearchQuery('')
                } else {
                  setSearchOpen(false)
                }
              }}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setActiveTab('messages')}
                  style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons
                    name={activeTab === 'messages' ? 'chatbubble' : 'chatbubble-outline'}
                    size={24}
                    color={activeTab === 'messages' ? colors.primary : '#888'}
                  />
                  {unreadCounts.normalUnread > 0 && (
                    <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: '#ff4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unreadCounts.normalUnread}</Text>
                    </View>
                  )}
                  {activeTab === 'messages' && (
                    <View style={{ position: 'absolute', bottom: 2, width: 16, height: 3, backgroundColor: colors.primary, borderRadius: 1.5 }} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveTab('requests')}
                  style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons
                    name={activeTab === 'requests' ? 'mail' : 'mail-outline'}
                    size={24}
                    color={activeTab === 'requests' ? colors.primary : '#888'}
                  />
                  {unreadCounts.spamUnread > 0 && (
                    <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: '#ff4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unreadCounts.spamUnread}</Text>
                    </View>
                  )}
                  {activeTab === 'requests' && (
                    <View style={{ position: 'absolute', bottom: 2, width: 16, height: 3, backgroundColor: colors.primary, borderRadius: 1.5 }} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSearchOpen(true)}
                  style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons name="search-outline" size={24} color="#888" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilterMenuVisible(true)}
                  style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Ionicons
                    name="filter"
                    size={24}
                    color={filterMode === 'unread' || showArchived ? colors.primary : '#888'}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
        )}
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
            <Ionicons name="chatbubbles-outline" size={64} color="#333" />
            <Text style={{ color: '#555', fontSize: 16, marginTop: 16 }}>
              {searchQuery
                ? 'Aucun résultat'
                : showArchived
                  ? 'Aucune conversation archivée'
                  : filterMode === 'unread'
                    ? 'Aucune conversation non lue'
                    : activeTab === 'messages'
                      ? 'Aucune conversation'
                      : 'Aucune demande'}
            </Text>
            {activeTab === 'messages' && !searchQuery && filterMode === 'all' && (
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={{ marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>Nouveau message</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const otherId = item.participants.find((p) => p !== userId)
          const otherUser = otherId ? usersMap[otherId] : null
          if (!otherUser) return null

          const lastReadAt = item.lastReadAt?.[userId || '']
          const lastMsgAt = item.lastMessage?.createdAt
          const isUnread = lastMsgAt && lastReadAt
            ? new Date(lastMsgAt).getTime() > new Date(lastReadAt).getTime()
            : false

          const isMine = item.lastMessage?.senderId === userId
          let deliveryStatus: 'sent' | 'delivered' | 'read' | undefined
          if (isMine && otherId && item.lastMessage?.createdAt) {
            const msgTime = new Date(item.lastMessage.createdAt).getTime()
            const otherReadAt = item.lastReadAt?.[otherId]
            const otherDeliveredAt = item.lastDeliveredAt?.[otherId]
            if (otherReadAt && new Date(otherReadAt).getTime() >= msgTime) {
              deliveryStatus = 'read'
            } else if (otherDeliveredAt && new Date(otherDeliveredAt).getTime() >= msgTime) {
              deliveryStatus = 'delivered'
            } else {
              deliveryStatus = 'sent'
            }
          }

          const pinned = item.pinnedBy?.includes(userId || '') ?? false
          const muted = item.mutedBy?.includes(userId || '') ?? false

          return (
            <ConversationItemWithStatus
              item={item}
              otherId={otherId}
              otherUser={otherUser}
              unread={isUnread}
              pinned={pinned}
              muted={muted}
              deliveryStatus={deliveryStatus}
              selectable={selectMode}
              selected={selectedIds.has(item.id)}
              onSelectToggle={() => toggleSelectItem(item.id)}
              onPress={() => {
                if (selectMode) {
                  toggleSelectItem(item.id)
                } else {
                  handleOpenConversation(item.id)
                }
              }}
              onLongPress={() => setMenuConv(item)}
              onSwipeDelete={async () => {
                if (!userId) return
                if (showArchived) {
                  await unarchiveConversation(item.id, userId)
                } else {
                  await deleteConversation(item.id, userId)
                }
              }}
              swipeIcon={showArchived ? 'archive' : undefined}
              swipeLabel={showArchived ? 'Désarchiver' : undefined}
              swipeColor={showArchived ? '#34b7f1' : undefined}
            />
          )
        }}
      />

      <NewConversationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelectUser={handleSelectUser}
        excludeUserId={userId || ''}
      />

      {filterMenuVisible && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setFilterMenuVisible(false)}
        >
          <View style={{
            position: 'absolute', top: 110, right: 16,
            backgroundColor: '#1a1a1a', borderRadius: 10,
            paddingVertical: 4, minWidth: 170,
            borderWidth: 0.5, borderColor: '#333',
          }}>
            <TouchableOpacity
              onPress={() => { setFilterMode((m) => (m === 'all' ? 'unread' : 'all')); setFilterMenuVisible(false) }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}
            >
              <Text style={{ color: colors.white, fontSize: 15 }}>Non lu</Text>
              {filterMode === 'unread' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
            <View style={{ height: 0.5, backgroundColor: '#333', marginHorizontal: 14 }} />
            <TouchableOpacity
              onPress={() => { setShowArchived((s) => !s); setFilterMenuVisible(false) }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}
            >
              <Text style={{ color: colors.white, fontSize: 15 }}>Archive</Text>
              {showArchived && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

          {menuConv && (
          <BottomSheet visible onClose={closeModal} height="auto" containerStyle={{ paddingBottom: 34 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 }}>
                <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                  {(() => {
                    const otherId = menuConv.participants.find((p) => p !== userId)
                    const otherUser = otherId ? usersMap[otherId] : null
                    return otherUser?.nom || otherUser?.pseudo || 'Conversation'
                  })()}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity onPress={() => {}}>
                    <Ionicons name="videocam-outline" size={28} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {}}>
                    <Ionicons name="call-outline" size={28} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ height: 0.5, backgroundColor: '#333', marginBottom: 4 }} />

              <MenuRow
                icon={(() => {
                  const lastReadAt = menuConv.lastReadAt?.[userId || '']
                  const lastMsgAt = menuConv.lastMessage?.createdAt
                  const isUnread = lastMsgAt && lastReadAt
                    ? new Date(lastMsgAt).getTime() > new Date(lastReadAt).getTime()
                    : false
                  return isUnread ? 'checkmark-done' : 'mail-unread-outline'
                })()}
                label={(() => {
                  const lastReadAt = menuConv.lastReadAt?.[userId || '']
                  const lastMsgAt = menuConv.lastMessage?.createdAt
                  const isUnread = lastMsgAt && lastReadAt
                    ? new Date(lastMsgAt).getTime() > new Date(lastReadAt).getTime()
                    : false
                  return isUnread ? 'Marquer comme lu' : 'Marquer comme non lu'
                })()}
                color="#fff"
                onPress={() => {
                  const lastReadAt = menuConv.lastReadAt?.[userId || '']
                  const lastMsgAt = menuConv.lastMessage?.createdAt
                  const isUnread = lastMsgAt && lastReadAt
                    ? new Date(lastMsgAt).getTime() > new Date(lastReadAt).getTime()
                    : false
                  if (isUnread) {
                    markConversationAsRead(menuConv.id, userId || '')
                  } else {
                    markConversationAsUnread(menuConv.id, userId || '')
                  }
                  closeModal()
                }}
              />

              <MenuRow
                icon={menuConv.pinnedBy?.includes(userId || '') ? 'flag' : 'flag-outline'}
                label={menuConv.pinnedBy?.includes(userId || '') ? 'Désépingler' : 'Épingler'}
                color="#fff"
                onPress={() => {
                  if (menuConv.pinnedBy?.includes(userId || '')) {
                    unpinConversation(menuConv.id, userId || '')
                  } else {
                    pinConversation(menuConv.id, userId || '')
                  }
                  closeModal()
                }}
              />

              <MenuRow
                icon={menuConv.mutedBy?.includes(userId || '') ? 'notifications-outline' : 'notifications-off-outline'}
                label={menuConv.mutedBy?.includes(userId || '') ? 'Activer les notifications' : 'Muet'}
                color="#fff"
                onPress={() => {
                  if (menuConv.mutedBy?.includes(userId || '')) {
                    unmuteConversation(menuConv.id, userId || '')
                  } else {
                    muteConversation(menuConv.id, userId || '')
                  }
                  closeModal()
                }}
              />

              <MenuRow
                icon={showArchived ? 'archive' : 'archive-outline'}
                label={showArchived ? 'Désarchiver' : 'Archiver'}
                color="#fff"
                onPress={() => {
                  if (showArchived) {
                    unarchiveConversation(menuConv.id, userId || '')
                  } else {
                    deleteConversation(menuConv.id, userId || '')
                  }
                  closeModal()
                }}
              />

              <MenuRow
                icon="checkbox-outline"
                label="Sélectionner"
                color="#fff"
                onPress={() => {
                  enterSelectMode(menuConv.id)
                  closeModal()
                }}
              />

              <View style={{ height: 8 }} />
              <View style={{ height: 0.5, backgroundColor: '#333' }} />
              <View style={{ height: 8 }} />

              <MenuRow icon="trash-outline" label="Supprimer" color="#ff4444" onPress={() => {
                deleteConversation(menuConv.id, userId || '')
                closeModal()
              }} />

              <MenuRow icon="ban-outline" label="Bloquer" color="#ff4444" onPress={() => {
                blockConversation(menuConv.id, userId || '')
                closeModal()
              }} />

              <View style={{ height: 8 }} />
              <View style={{ height: 0.5, backgroundColor: '#333' }} />

          </BottomSheet>
          )}
    </SafeAreaView>
  )
}
