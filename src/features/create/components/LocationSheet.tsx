/* src/features/create/components/LocationSheet.tsx

   Choix du lieu d'une publication (style Instagram) :
   - Position actuelle (détection GPS, async) ;
   - Saisie libre d'un nom de lieu (pas de base de lieux dans le projet —
     le typeahead Instagram n'a pas d'équivalent local) ;
   - Retrait du lieu si déjà posé. */

import { memo, useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import BottomSheet from '@/components/ui/BottomSheet'
import { useI18n } from '@/i18n'
import type { NewsLocation } from '@/features/news/types'
import { cameraColors, createColors, createType } from '../theme/createTokens'

interface LocationSheetProps {
  visible: boolean
  value: NewsLocation | null
  /* Détection GPS en cours (parent, via locationService). */
  detecting: boolean
  /* Déclenche la détection ; en cas d'échec, le parent affiche l'erreur. */
  onDetect: () => void
  /* Choisi : un lieu détecté, un lieu saisi, ou null (retrait). */
  onSelect: (location: NewsLocation | null) => void
  onClose: () => void
}

function LocationSheetBase({
  visible,
  value,
  detecting,
  onDetect,
  onSelect,
  onClose,
}: LocationSheetProps) {
  const { t } = useI18n()
  const [manual, setManual] = useState('')

  const handleDetect = useCallback(() => {
    onDetect()
  }, [onDetect])

  const handleManual = useCallback(() => {
    const name = manual.trim()
    if (!name) return
    onSelect({ name })
    setManual('')
  }, [manual, onSelect])

  const handleRemove = useCallback(() => {
    onSelect(null)
    setManual('')
  }, [onSelect])

  return (
    <BottomSheet visible={visible} onClose={onClose} height="auto">
      <View style={styles.sheet}>
        <Text style={styles.title}>{t.news.compose.locationAdd}</Text>

        {/* Position actuelle */}
        <Pressable
          onPress={handleDetect}
          disabled={detecting}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.locationCurrent}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons
            name={detecting ? 'locate' : 'location-outline'}
            size={20}
            color={createColors.textPrimary}
          />
          <Text style={styles.rowLabel}>
            {detecting ? t.news.compose.locationDetecting : t.news.compose.locationCurrent}
          </Text>
        </Pressable>

        {/* Saisie libre */}
        <View style={styles.manualRow}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            onSubmitEditing={handleManual}
            placeholder={t.news.compose.locationManualHint}
            placeholderTextColor={createColors.textSecondary}
            style={styles.input}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleManual}
            disabled={manual.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.locationManualAdd}
            style={({ pressed }) => [
              styles.addBtn,
              manual.trim().length === 0 && styles.addBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={18} color={cameraColors.onMedia} />
          </Pressable>
        </View>

        {/* Lieu déjà posé */}
        {value ? (
          <Pressable
            onPress={handleRemove}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.locationRemove}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="close-circle-outline" size={20} color={createColors.danger} />
            <Text style={[styles.rowLabel, styles.removeLabel]}>
              {t.news.compose.locationRemove}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  title: {
    color: createColors.textPrimary,
    ...createType.title,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowLabel: {
    flex: 1,
    color: createColors.textPrimary,
    fontSize: 15,
  },
  removeLabel: {
    color: createColors.danger,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: createColors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: createColors.surface,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: createColors.accent,
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  pressed: { opacity: 0.6 },
})

export const LocationSheet = memo(LocationSheetBase)
