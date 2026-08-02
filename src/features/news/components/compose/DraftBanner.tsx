/* src/features/news/components/compose/DraftBanner.tsx
   Proposition de reprise d'un brouillon. Le brouillon n'est jamais restauré
   d'office : réapparaître avec un ancien texte alors qu'on venait écrire
   autre chose est plus gênant que devoir toucher « Reprendre ». */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'

interface DraftBannerProps {
  preview: string
  onResume: () => void
  onDiscard: () => void
}

function DraftBannerBase({ preview, onResume, onDiscard }: DraftBannerProps) {
  const { t } = useI18n()

  return (
    <View style={styles.banner}>
      <Ionicons name="document-text-outline" size={18} color={postColors.accent} />

      <View style={styles.texts}>
        <Text style={styles.title}>{t.news.compose.draftBanner}</Text>
        {preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onResume}
        accessibilityRole="button"
        style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
      >
        <Text style={styles.resumeText}>{t.news.compose.draftResume}</Text>
      </Pressable>

      <Pressable
        onPress={onDiscard}
        accessibilityRole="button"
        accessibilityLabel={t.news.compose.draftDiscard}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Ionicons name="close" size={18} color={postColors.textSecondary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.rowGap,
    marginHorizontal: postSpacing.gutter,
    marginTop: postSpacing.rowGap,
    padding: postSpacing.gutter,
    borderRadius: postRadius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: postColors.inputBorder,
    backgroundColor: postColors.accentSoft,
  },
  texts: { flex: 1, gap: 2 },
  title: { color: postColors.textPrimary, ...postType.composeSection },
  preview: { color: postColors.textSecondary, ...postType.meta },
  resume: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.accent,
  },
  resumeText: { color: postColors.onMedia, ...postType.action },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const DraftBanner = memo(DraftBannerBase)
