/* CameraToolbar.tsx — Barre d'outils de la caméra studio.

   Affiche en bas de l'écran (au-dessus du shutter) :
   - Sélecteur de ratio d'aspect
   - Sélecteur de vitesse de capture (vidéo uniquement)
   - Bouton toggle grid
   - Sélecteur de durée max vidéo

   Design : rangée horizontale scrollable, icônes compactes,
   fond semi-transparent noir. */

import { memo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { cameraColors, createMotion } from '../../theme/createTokens'
import type { AspectRatioValue, CaptureSpeed } from '../../types/editing'
import { ASPECT_RATIOS, CAPTURE_SPEEDS } from '../../types/editing'

interface CameraToolbarProps {
  /** Mode caméra actuel. */
  captureMode: 'photo' | 'video'
  /** Ratio d'aspect sélectionné. */
  aspectRatio: AspectRatioValue
  /** Callback changement de ratio. */
  onAspectRatioChange: (ratio: AspectRatioValue) => void
  /** Vitesse de capture sélectionnée. */
  captureSpeed: CaptureSpeed
  /** Callback changement de vitesse. */
  onCaptureSpeedChange: (speed: CaptureSpeed) => void
  /** Délai du compte à rebours avant enregistrement. */
  timerDelay: 0 | 3 | 10
  /** Callback changement du compte à rebours. */
  onTimerDelayChange: (seconds: 0 | 3 | 10) => void
  /** Grille active. */
  showGrid: boolean
  /** Toggle grille. */
  onToggleGrid: () => void
  /** Durée max vidéo (secondes). */
  maxDuration: number
  /** Callback changement durée. */
  onMaxDurationChange: (seconds: number) => void
}

const DURATION_OPTIONS = [15, 30, 60, 180, 600]
const TIMER_OPTIONS = [0, 3, 10] as const

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return `${m}min`
}

function CameraToolbarComponent({
  captureMode,
  aspectRatio,
  onAspectRatioChange,
  captureSpeed,
  onCaptureSpeedChange,
  timerDelay,
  onTimerDelayChange,
  showGrid,
  onToggleGrid,
  maxDuration,
  onMaxDurationChange,
}: CameraToolbarProps) {
  const { t } = useI18n()

  return (
    <View style={styles.container}>
      {/* ── Ligne du haut : ratio + grid ─────────────────────────── */}
      <View style={styles.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {ASPECT_RATIOS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => onAspectRatioChange(r.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: aspectRatio === r.value }}
              accessibilityLabel={t.news.compose.a11yAspectRatio.replace('{label}', r.label)}
              style={({ pressed }) => [
                styles.chip,
                aspectRatio === r.value && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  aspectRatio === r.value && styles.chipTextActive,
                ]}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={onToggleGrid}
            accessibilityRole="button"
            accessibilityState={{ selected: showGrid }}
            accessibilityLabel={t.news.compose.a11yGrid}
            style={({ pressed }) => [
              styles.chip,
              showGrid && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={showGrid ? cameraColors.chipContentActive : cameraColors.chipContentIdle}
            />
          </Pressable>
        </ScrollView>
      </View>

      {/* ── Ligne du bas : vitesse (vidéo) + durée ──────────────── */}
      {captureMode === 'video' ? (
        <View style={styles.row}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {CAPTURE_SPEEDS.map((s) => (
              <Pressable
                key={s.value}
                onPress={() => onCaptureSpeedChange(s.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: captureSpeed === s.value }}
                accessibilityLabel={t.news.compose.a11yCaptureSpeed.replace('{label}', s.label)}
                style={({ pressed }) => [
                  styles.chip,
                  captureSpeed === s.value && styles.chipActive,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    captureSpeed === s.value && styles.chipTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}

            {captureMode === 'video' ? (
              <>
                <View style={styles.separator} />
                {TIMER_OPTIONS.map((delay) => (
                  <Pressable
                    key={delay}
                    onPress={() => onTimerDelayChange(delay)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: timerDelay === delay }}
                    accessibilityLabel={t.news.compose.a11yTimerDelay.replace(
                      '{label}',
                      formatDuration(delay),
                    )}
                    style={({ pressed }) => [
                      styles.chip,
                      timerDelay === delay && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        timerDelay === delay && styles.chipTextActive,
                      ]}
                    >
                      {formatDuration(delay)}
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            <View style={styles.separator} />

            {DURATION_OPTIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => onMaxDurationChange(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: maxDuration === d }}
                accessibilityLabel={t.news.compose.a11yMaxDuration.replace(
                  '{label}',
                  formatDuration(d),
                )}
                style={({ pressed }) => [
                  styles.chip,
                  maxDuration === d && styles.chipActive,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    maxDuration === d && styles.chipTextActive,
                  ]}
                >
                  {formatDuration(d)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}

export const CameraToolbar = memo(CameraToolbarComponent)

const styles = StyleSheet.create({
  container: {
    gap: 6,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
  },
  scrollContent: {
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: cameraColors.chipIdle,
  },
  chipPressed: {
    opacity: createMotion.pressedOpacity,
  },
  chipActive: {
    backgroundColor: cameraColors.chipActive,
  },
  chipText: {
    color: cameraColors.chipContentIdle,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: cameraColors.chipContentActive,
  },
  separator: {
    width: 1,
    height: 24,
    alignSelf: 'center',
    backgroundColor: cameraColors.chipSeparator,
  },
})
