import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db, auth } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { BackButton } from '../../src/components/ui/BackButton'
import { OrbitLoader } from '../../src/components/ui/OrbitLoader'
import { captureException } from '../../src/lib/sentry'

export default function BlockedWords() {
  const [words, setWords] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) { setLoading(false); return }
    getDoc(doc(db, 'users', uid)).then((snap) => {
      if (snap.exists()) {
        const w = snap.data()?.blockedWords
        if (Array.isArray(w)) setWords(w.map((s: string) => s.toLowerCase()))
      }
    }).catch((e) => captureException(e instanceof Error ? e : new Error(String(e)), { context: 'blockedWords:load' }))
      .finally(() => setLoading(false))
  }, [])

  const addWord = async () => {
    const word = input.trim().toLowerCase()
    if (!word || words.includes(word)) { setInput(''); return }
    const uid = auth.currentUser?.uid
    if (!uid) return
    try {
      await updateDoc(doc(db, 'users', uid), { blockedWords: arrayUnion(word) })
      setWords((prev) => [...prev, word])
      setInput('')
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'blockedWords:add' }) }
  }

  const removeWord = async (word: string) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    try {
      await updateDoc(doc(db, 'users', uid), { blockedWords: arrayRemove(word) })
      setWords((prev) => prev.filter((w) => w !== word))
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'blockedWords:remove' }) }
  }

  const renderItem = ({ item }: { item: string }) => (
    <View style={styles.wordRow}>
      <Text style={styles.wordText}>{item}</Text>
      <TouchableOpacity onPress={() => removeWord(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.header}>
        <BackButton icon="chevron-back" style={{ width: 36, height: 36, justifyContent: 'center' }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>Mots bloqués</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ajouter un mot..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          onSubmitEditing={addWord}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={addWord} style={[styles.addButton, !input.trim() && { opacity: 0.4 }]}>
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Les commentaires contenant ces mots seront masqués pour les autres utilisateurs.
      </Text>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <OrbitLoader size={28} />
        </View>
      ) : words.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.textFaint} />
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12 }}>Aucun mot bloqué</Text>
        </View>
      ) : (
        <FlatList
          data={words}
          keyExtractor={(item) => item}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
  },
  wordText: {
    color: colors.white,
    fontSize: 15,
  },
})
