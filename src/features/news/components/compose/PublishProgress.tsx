/* src/features/news/components/compose/PublishProgress.tsx
   Voile de publication. Il couvre l'écran parce que toucher le formulaire
   pendant l'envoi n'a aucun effet utile — mieux vaut le dire clairement. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OrbitLoader from '@/components/OrbitLoader'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'

interface PublishProgressProps {
  progress: number
  /* Annulation utilisateur : le brouillon est conservé, on revient à la
     légende. Absent → pas de bouton (voile bloquant). */
  onCancel?: () => void
}

function PublishProgressBase({ progress, onCancel }: PublishProgressProps) {
  const { t } = useI18n()

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <OrbitLoader size={64} />

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>

        <Text style={styles.label}>
          {t.news.compose.publishing.replace('{n}', String(progress))}
        </Text>

        {onCancel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.cancelPublish}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={18} color={postColors.textSecondary} />
            <Text style={styles.cancelText}>{t.news.compose.cancelPublish}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimHeavy,
  },
  card: {
    alignItems: 'center',
    gap: postSpacing.gutter,
    width: 240,
    padding: postSpacing.gutter * 1.5,
    borderRadius: postRadius.input,
    backgroundColor: postColors.surface,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: postColors.progressTrack,
  },
  fill: { height: '100%', backgroundColor: postColors.accent },
  label: { color: postColors.textSecondary, ...postType.composeCounter },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: postRadius.input,
  },
  cancelText: {
    color: postColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const PublishProgress = memo(PublishProgressBase)
