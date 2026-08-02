/* src/features/news/components/compose/LocationChip.tsx
   Lieu attaché à la publication, retirable d'un geste. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { HIT_SLOP, postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'
import type { NewsLocation } from '../../types'

interface LocationChipProps {
  location: NewsLocation | null
  detecting: boolean
  onRemove: () => void
}

function LocationChipBase({ location, detecting, onRemove }: LocationChipProps) {
  const { t } = useI18n()

  if (!location && !detecting) return null

  return (
    <View style={styles.chip}>
      <Ionicons name="location" size={15} color={postColors.optionLocation} />
      <Text style={styles.text} numberOfLines={1}>
        {location?.name ?? t.news.compose.locationDetecting}
      </Text>

      {location ? (
        <Pressable
          onPress={onRemove}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.locationRemove}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="close" size={15} color={postColors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: postSpacing.inlineGap,
    marginHorizontal: postSpacing.gutter,
    marginBottom: postSpacing.blockBottom,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.chipSurface,
  },
  text: { maxWidth: 240, color: postColors.textPrimary, ...postType.meta },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const LocationChip = memo(LocationChipBase)
