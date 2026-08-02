/* src/features/news/components/compose/MoodSheet.tsx
   Choix d'humeur. Les libellés viennent de t.news.moods, déjà utilisé par
   l'en-tête de carte : l'humeur choisie ici s'affiche exactement telle
   qu'elle apparaîtra dans le fil. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import BottomSheet from '@/components/ui/BottomSheet'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'
import type { NewsMood } from '../../types'

/** Palette volontairement courte : une grille exhaustive devient un catalogue. */
const MOOD_EMOJIS = ['😀', '🥰', '😎', '😢', '😡', '🎉', '😴', '🙏'] as const

interface MoodSheetProps {
  visible: boolean
  value: NewsMood | null
  onChange: (mood: NewsMood | null) => void
  onClose: () => void
}

function MoodSheetBase({ visible, value, onChange, onClose }: MoodSheetProps) {
  const { t } = useI18n()
  const labels = t.news.moods as Record<string, string | undefined>

  return (
    <BottomSheet visible={visible} onClose={onClose} height="auto">
      <View style={styles.sheet}>
        <Text style={styles.title}>{t.news.compose.moodTitle}</Text>

        <View style={styles.grid}>
          {MOOD_EMOJIS.map((emoji) => {
            const label = labels[emoji] ?? emoji
            const active = value?.emoji === emoji

            return (
              <Pressable
                key={emoji}
                onPress={() => {
                  onChange({ emoji, label })
                  onClose()
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                style={({ pressed }) => [
                  styles.cell,
                  active && styles.cellActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emoji}>{emoji}</Text>
                <Text style={styles.label} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {value ? (
          <Pressable
            onPress={() => {
              onChange(null)
              onClose()
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>{t.news.compose.moodClear}</Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: postSpacing.gutter, paddingBottom: 28 },
  title: {
    color: postColors.textPrimary,
    ...postType.composeSection,
    paddingVertical: postSpacing.rowGap,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: postSpacing.inlineGap },
  cell: {
    width: '23%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: postRadius.input,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: postColors.chipSurface,
  },
  cellActive: { borderColor: postColors.accent },
  emoji: { ...postType.composeEmoji },
  label: { color: postColors.textSecondary, ...postType.meta },
  clear: { alignItems: 'center', paddingTop: postSpacing.gutter },
  clearText: { color: postColors.textSecondary, ...postType.link },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const MoodSheet = memo(MoodSheetBase)
