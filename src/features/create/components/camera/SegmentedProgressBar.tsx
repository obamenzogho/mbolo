import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useI18n } from '@/i18n'
import { cameraColors, createColors } from '../../theme/createTokens'
import type { RecordingSegment } from '../../types/editing'

interface SegmentedProgressBarProps {
  segments: readonly RecordingSegment[]
  totalDurationMs: number
  maxDurationMs: number
  onRemoveLast: () => void
}

export const SegmentedProgressBar = memo(function SegmentedProgressBar({
  segments,
  totalDurationMs,
  maxDurationMs,
  onRemoveLast,
}: SegmentedProgressBarProps) {
  const { t } = useI18n()
  const progress = maxDurationMs > 0 ? totalDurationMs / maxDurationMs : 0

  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <View style={styles.track}>
        <View style={[styles.progress, { width: `${Math.min(100, progress * 100)}%` }]}>
          {segments.map((segment, index) => (
            <View
              key={`${segment.uri}-${index}`}
              style={[styles.segment, index < segments.length - 1 && styles.segmentGap]}
            />
          ))}
        </View>
      </View>
      <Pressable
        onPress={onRemoveLast}
        disabled={segments.length === 0}
        accessibilityRole="button"
        accessibilityLabel={t.news.compose.a11yUndoLastSegment}
        style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
      >
        <View style={styles.undoMark} />
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  track: { flex: 1, height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: cameraColors.chipIdle },
  progress: { height: '100%', flexDirection: 'row', gap: 2, backgroundColor: createColors.accent },
  segment: { flex: 1, minWidth: 3, backgroundColor: createColors.accent },
  segmentGap: { borderRightWidth: 2, borderRightColor: createColors.canvas },
  undo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: cameraColors.chipIdle },
  undoMark: { width: 14, height: 14, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: cameraColors.chipContentActive, transform: [{ rotate: '45deg' }] },
  pressed: { opacity: 0.7 },
})
