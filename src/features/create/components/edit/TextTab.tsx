/* TextTab.tsx — Onglet Text de l'éditeur.

   Ajout de texte avec couleur et police. */

import { memo, useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { OverlayEl } from '../../types/editing'
import { COLORS } from '../../types/editing'
import { createColors } from '../../theme/createTokens'

const FONTS = [
  { id: 'modern', name: 'Modern' },
  { id: 'classic', name: 'Classic' },
  { id: 'strong', name: 'Strong' },
]

const uid = () => Math.random().toString(36).slice(2)

interface TextTabProps {
  overlays: OverlayEl[]
  onOverlaysChange: (els: OverlayEl[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export const TextTab = memo(function TextTab({
  overlays,
  onOverlaysChange,
  selectedId,
  onSelect,
}: TextTabProps) {
  const selText = overlays.find(
    (e) => e.id === selectedId && e.kind === 'text',
  ) as Extract<OverlayEl, { kind: 'text' }> | undefined

  const addText = useCallback(() => {
    const id = uid()
    onOverlaysChange([
      ...overlays,
      { id, kind: 'text', text: 'Your text', x: 0.5, y: 0.5, color: '#ffffff', fontId: 'modern', size: 0.075 },
    ])
    onSelect(id)
  }, [overlays, onOverlaysChange, onSelect])

  const updateText = useCallback(
    (text: string) => {
      if (!selText) return
      onOverlaysChange(
        overlays.map((e) => (e.id === selText.id ? { ...e, text } : e)),
      )
    },
    [selText, overlays, onOverlaysChange],
  )

  const updateColor = useCallback(
    (color: string) => {
      if (!selText) return
      onOverlaysChange(
        overlays.map((e) => (e.id === selText.id ? { ...e, color } : e)),
      )
    },
    [selText, overlays, onOverlaysChange],
  )

  const cycleFont = useCallback(() => {
    if (!selText) return
    const i = FONTS.findIndex((f) => f.id === selText.fontId)
    onOverlaysChange(
      overlays.map((e) =>
        e.id === selText.id
          ? { ...e, fontId: FONTS[(i + 1) % FONTS.length].id }
          : e,
      ),
    )
  }, [selText, overlays, onOverlaysChange])

  const removeText = useCallback(() => {
    if (!selText) return
    onOverlaysChange(overlays.filter((e) => e.id !== selText.id))
    onSelect(null)
  }, [selText, overlays, onOverlaysChange, onSelect])

  return (
    <View style={styles.container}>
      <Pressable onPress={addText} style={styles.addBtn}>
        <Text style={styles.addBtnText}>+ Ajouter du texte</Text>
      </Pressable>

      {selText ? (
        <>
          <TextInput
            value={selText.text}
            onChangeText={updateText}
            placeholder="Écris quelque chose…"
            placeholderTextColor={createColors.textTertiary}
            style={styles.input}
          />

          {/* Couleur */}
          <View style={styles.row}>
            <Text style={styles.label}>Couleur</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colors}
            >
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => updateColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    selText.color.toLowerCase() === c.toLowerCase() && styles.colorDotActive,
                  ]}
                />
              ))}
            </ScrollView>
          </View>

          {/* Police + supprimer */}
          <View style={styles.row}>
            <Pressable onPress={cycleFont} style={styles.fontBtn}>
              <Text style={styles.fontBtnText}>Police : {FONTS.find((f) => f.id === selText.fontId)?.name}</Text>
            </Pressable>
            <Pressable onPress={removeText} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Supprimer</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.hint}>
          Ajoute du texte, déplace-le, ou tape sur un texte pour le modifier
        </Text>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { gap: 8 },
  addBtn: {
    backgroundColor: createColors.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    color: createColors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 11,
    color: createColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 52,
  },
  colors: { gap: 10 },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: createColors.accent,
  },
  fontBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fontBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: createColors.textPrimary,
  },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,60,60,0.8)',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  hint: {
    fontSize: 11,
    color: createColors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
})
