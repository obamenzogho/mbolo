import { useState, useCallback, useRef } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { colors } from '@/lib/theme'

export interface TaggableUser {
  id: string
  pseudo: string
  nom?: string
  photoURL?: string
}

interface Props {
  visible: boolean
  selected: TaggableUser[]
  onClose: () => void
  onChange: (users: TaggableUser[]) => void
}

export function TagPeopleSelector({ visible, selected, onClose, onChange }: Props) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<TaggableUser[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (t: string) => {
    const q = t.trim().toLowerCase()
    if (!q) { setResults([]); return }
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('pseudoLower', '>=', q),
      where('pseudoLower', '<=', q + '\uf8ff'),
      limit(15),
    ))
    const me = auth.currentUser?.uid
    setResults(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((u) => u.id !== me),
    )
  }, [])

  const onType = (t: string) => {
    setTerm(t)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(t), 350)
  }

  const toggle = (u: TaggableUser) => {
    const exists = selected.some((s) => s.id === u.id)
    if (exists) onChange(selected.filter((s) => s.id !== u.id))
    else if (selected.length < 20) onChange([...selected, u])
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
            Identifier des personnes
          </Text>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>OK ({selected.length})</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={term}
          onChangeText={onType}
          placeholder="Rechercher un pseudo..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          style={{ backgroundColor: colors.surface, color: colors.text, margin: 16, borderRadius: 10, padding: 12 }}
        />

        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => {
            const isSel = selected.some((s) => s.id === item.id)
            return (
              <TouchableOpacity
                onPress={() => toggle(item)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Image source={{ uri: item.photoURL }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text }}>@{item.pseudo}</Text>
                  {item.nom ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.nom}</Text> : null}
                </View>
                <Ionicons
                  name={isSel ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSel ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            )
          }}
        />
      </View>
    </Modal>
  )
}
