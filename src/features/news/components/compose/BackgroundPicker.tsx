/* src/features/news/components/compose/BackgroundPicker.tsx
   Sélecteur de fond dégradé, réservé au texte seul. La pastille active porte
   un anneau plutôt qu'une coche : la coche masquerait la couleur choisie. */

import { memo } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postSpacing } from '../../theme/postTokens'
import { POST_BACKGROUNDS, type PostBackgroundId } from '../../types'

interface BackgroundPickerProps {
  value: PostBackgroundId
  onChange: (id: PostBackgroundId) => void
}

function BackgroundPickerBase({ value, onChange }: BackgroundPickerProps) {
  const { t } = useI18n()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {POST_BACKGROUNDS.map((background) => {
        const active = background.id === value
        const isNone = background.id === 'none'

        return (
          <Pressable
            key={background.id}
            onPress={() => onChange(background.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.news.compose.backgroundPick}
            style={({ pressed }) => [
              styles.swatch,
              active && styles.swatchActive,
              pressed && styles.pressed,
            ]}
          >
            <LinearGradient
              colors={background.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            >
              {isNone ? (
                <View style={styles.noneMark}>
                  <Ionicons name="text" size={15} color={postColors.textSecondary} />
                </View>
              ) : null}
            </LinearGradient>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: {
    gap: postSpacing.inlineGap,
    paddingHorizontal: postSpacing.gutter,
    paddingBottom: postSpacing.blockBottom,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: postColors.accent },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noneMark: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const BackgroundPicker = memo(BackgroundPickerBase)
