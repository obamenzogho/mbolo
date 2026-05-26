import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  FlatList, Alert, Dimensions, StyleSheet, Modal,
} from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../lib/theme'
import { useHighlights } from '@/features/highlights/hooks/useHighlights'
import { auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'

interface HighlightPickerModalProps {
  visible: boolean
  onClose: () => void
  storyId: string | null
  coverUri?: string
}

export default function HighlightPickerModal({ visible, onClose, storyId, coverUri }: HighlightPickerModalProps) {
  const user = auth.currentUser
  const { highlights, createHighlight, addToHighlight } = useHighlights(user?.uid || '')
  const [newTitle, setNewTitle] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const sheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['55%'], [])

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand()
    } else {
      sheetRef.current?.close()
      setTimeout(() => {
        setShowNewForm(false)
        setNewTitle('')
      }, 300)
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
    []
  )

  const handleCreate = async () => {
    if (!newTitle.trim() || !storyId) return
    if (newTitle.length > 15) {
      Alert.alert('Erreur', 'Le titre doit faire 15 caractères maximum')
      return
    }
    try {
      const highlightId = await createHighlight(newTitle.trim(), coverUri || '', [])
      await addToHighlight(highlightId, storyId)
      sheetRef.current?.close()
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'createHighlight' })
      Alert.alert('Erreur', 'Impossible de créer la mise en avant')
    }
  }

  const handleAddToExisting = async (highlightId: string) => {
    if (!storyId) return
    try {
      await addToHighlight(highlightId, storyId)
      sheetRef.current?.close()
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'addToHighlight' })
      Alert.alert('Erreur', 'Impossible d\'ajouter à la mise en avant')
    }
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => handleAddToExisting(item.id)}
      style={styles.highlightItem}
    >
      <View style={styles.highlightCover}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.highlightImage} resizeMode="cover" />
        ) : (
          <View style={styles.highlightPlaceholder}>
            <Ionicons name="images" size={24} color="#444" />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.highlightTitle}>{item.title}</Text>
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        onChange={handleSheetChanges}
      >
      <BottomSheetView style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Ajouter à la une</Text>
          <TouchableOpacity onPress={() => sheetRef.current?.close()} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {showNewForm ? (
          <View style={styles.formSection}>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Nom de la mise en avant"
              placeholderTextColor="#555"
              maxLength={15}
              style={styles.input}
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => setShowNewForm(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={!newTitle.trim()}
                style={[styles.createBtn, { opacity: newTitle.trim() ? 1 : 0.4 }]}
              >
                <Text style={styles.createBtnText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setShowNewForm(true)}
              style={styles.newHighlightBtn}
            >
              <View style={styles.newHighlightCover}>
                <Ionicons name="add" size={28} color={colors.primary} />
              </View>
              <Text style={styles.newHighlightText}>Nouveau</Text>
            </TouchableOpacity>

            {highlights.length > 0 ? (
              <FlatList
                data={highlights}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="albums" size={40} color="#333" />
                <Text style={styles.emptyText}>Aucune mise en avant</Text>
              </View>
            )}
          </>
        )}
      </BottomSheetView>
      </BottomSheet>
    </Modal>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: '#444',
    width: 40,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  formSection: {
    marginTop: 8,
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  createBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  newHighlightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  newHighlightCover: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newHighlightText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 16,
  },
  highlightItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  highlightCover: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#333',
  },
  highlightImage: {
    width: '100%',
    height: '100%',
  },
  highlightPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightTitle: {
    color: '#fff',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#555',
    fontSize: 13,
    marginTop: 8,
  },
})