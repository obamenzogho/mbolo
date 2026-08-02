/* src/features/news/components/compose/PublishProgress.tsx
   Voile de publication. Il couvre l'écran parce que toucher le formulaire
   pendant l'envoi n'a aucun effet utile — mieux vaut le dire clairement. */

import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import OrbitLoader from '@/components/OrbitLoader'
import { useI18n } from '@/i18n'
import { postColors, postRadius, postSpacing, postType } from '../../theme/postTokens'

interface PublishProgressProps {
  progress: number
}

function PublishProgressBase({ progress }: PublishProgressProps) {
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
})

export const PublishProgress = memo(PublishProgressBase)
