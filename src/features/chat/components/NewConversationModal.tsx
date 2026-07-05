import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import {
  collection, query, where, limit, getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Avatar } from '@/components/ui/Avatar'
import { colors } from '@/lib/theme'
import { useFriendsList } from '@/features/chat/hooks/useFriendsList'

interface NewConversationModalProps {
  visible: boolean
  onClose: () => void
  onSelectUser: (userId: string) => void
  excludeUserId: string
}

interface UserResult {
  id: string
  pseudo: string
  nom?: string
  photoURL?: string
}

export function NewConversationModal({
  visible, onClose, onSelectUser, excludeUserId,
}: NewConversationModalProps) {
  const sheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['90%'], [])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const { friends, loading: friendsLoading } = useFriendsList()

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand()
    } else {
      sheetRef.current?.close()
    }
  }, [visible])

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) onClose()
  }, [onClose])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    [],
  )

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([])
      return
    }
    try {
      const termLower = q.toLowerCase()
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('pseudoLower', '>=', termLower),
          where('pseudoLower', '<=', termLower + '\uf8ff'),
          limit(20),
        ),
      )
      const items = snap.docs
        .map((d: any) => ({ id: d.id, ...d.data() } as UserResult))
        .filter((u: UserResult) => u.id !== excludeUserId)
      setResults(items)
    } catch {
      setResults([])
    }
  }, [excludeUserId])

  useEffect(() => {
    if (!visible) return
    searchUsers(search)
  }, [search, searchUsers, visible])

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      handleIndicatorStyle={{ backgroundColor: '#444', width: 40 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={handleSheetChanges}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
        <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700', flex: 1 }}>
          Nouveau message
        </Text>

      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un utilisateur..."
          placeholderTextColor="#555"
          style={{
            backgroundColor: '#1a1a1a', color: colors.white,
            borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
          }}
        />
      </View>
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {search === '' ? (
          <>
            <Text style={{
              color: '#888', fontSize: 13, fontWeight: '600',
              paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
              textTransform: 'uppercase',
            }}>
              Tes amis
            </Text>
            {friendsLoading ? (
              <View style={{ paddingTop: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#555" />
              </View>
            ) : friends.length === 0 ? (
              <View style={{ paddingTop: 20, alignItems: 'center' }}>
                <Ionicons name="people-outline" size={48} color="#333" />
                <Text style={{ color: '#555', fontSize: 14, marginTop: 12 }}>Aucun ami pour le moment</Text>
              </View>
            ) : (
              friends.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    onSelectUser(item.id)
                    onClose()
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 }}
                >
                  <Avatar uri={item.photoURL} name={item.nom || item.pseudo} size={48} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>
                      {item.nom || item.pseudo}
                    </Text>
                    {item.pseudo ? (
                      <Text style={{ color: '#888', fontSize: 13 }}>@{item.pseudo}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : results.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <Ionicons name="search-outline" size={48} color="#333" />
            <Text style={{ color: '#555', fontSize: 14, marginTop: 12 }}>Aucun résultat</Text>
          </View>
        ) : (
          results.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                onSelectUser(item.id)
                onClose()
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 }}
            >
              <Avatar uri={item.photoURL} name={item.nom || item.pseudo} size={48} />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>
                  {item.nom || item.pseudo}
                </Text>
                {item.pseudo ? (
                  <Text style={{ color: '#888', fontSize: 13 }}>@{item.pseudo}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}
