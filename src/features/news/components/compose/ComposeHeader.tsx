/* src/features/news/components/compose/ComposeHeader.tsx
   Barre supérieure : fermer · titre · action de publication.
   Le bouton reste visible mais désactivé tant que rien n'est publiable —
   le masquer ferait disparaître la cible sous le doigt de l'utilisateur. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OrbitLoader from '@/components/OrbitLoader'
import { useI18n } from '@/i18n'
import { HIT_SLOP, postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'

interface ComposeHeaderProps {
  editing: boolean
  canPublish: boolean
  publishing: boolean
  /** Titre affiché à la place du titre de création. */
  title?: string
  /** Libellé de l'action de droite (« Suivant » à l'étape de choix). */
  actionLabel?: string
  /** Flèche plutôt que croix : on remonte d'une étape, on ne quitte pas. */
  leading?: 'close' | 'back'
  onClose: () => void
  onPublish: () => void
}

function ComposeHeaderBase({
  editing,
  canPublish,
  publishing,
  title,
  actionLabel,
  leading = 'close',
  onClose,
  onPublish,
}: ComposeHeaderProps) {
  const { t } = useI18n()
  const disabled = !canPublish || publishing

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onClose}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t.news.compose.a11yClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Ionicons
          name={leading === 'back' ? 'arrow-back' : 'close'}
          size={26}
          color={postColors.textPrimary}
        />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title ?? (editing ? t.news.compose.titleEdit : t.news.compose.title)}
      </Text>

      <Pressable
        onPress={onPublish}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={t.news.compose.a11yPublish}
        style={({ pressed }) => [
          styles.action,
          disabled && styles.actionDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {publishing ? (
          <OrbitLoader size={20} />
        ) : (
          <Text style={[styles.actionText, disabled && styles.actionTextDisabled]}>
            {actionLabel ?? (editing ? t.news.compose.save : t.news.compose.publish)}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.rowGap,
    paddingHorizontal: postSpacing.gutter,
    paddingTop: postSpacing.headerTop,
    paddingBottom: postSpacing.headerBottom,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: postColors.hairline,
  },
  close: { padding: 2 },
  title: { flex: 1, color: postColors.textPrimary, ...postType.composeTitle },
  action: {
    minWidth: 84,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.accent,
  },
  actionDisabled: { backgroundColor: postColors.surfaceRaised },
  actionText: { color: postColors.onMedia, ...postType.composeOption },
  actionTextDisabled: { color: postColors.textTertiary },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const ComposeHeader = memo(ComposeHeaderBase)
