/* CropTab.tsx — Onglet Crop de l'éditeur.

   Rapports d'aspect (Original, 1:1, 4:5, 1.91:1, 16:9),
   rotation 90°, flip H/V, straighten slider (-45°..45°). */

import { memo, useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import type { CropState } from '../../types/editing'
import {
  ASPECT_OPTIONS,
  DEFAULT_CROP,
  FREEFORM_ASPECT_MAX,
  FREEFORM_ASPECT_MIN,
} from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { StraightenSlider } from './StraightenSlider'

interface CropTabProps {
  crop: CropState
  onChange: (crop: CropState) => void
  /** Reset complet : crop + pan/zoom + transform. */
  onReset?: () => void
}

export const CropTab = memo(function CropTab({ crop, onChange, onReset }: CropTabProps) {
  const { t } = useI18n()
  const setAspect = useCallback(
    (ratio: number) => onChange({ ...crop, aspect: ratio, freeformAspect: undefined }),
    [crop, onChange],
  )

  const enableFreeform = useCallback(
    () => onChange({ ...crop, aspect: DEFAULT_CROP.aspect, freeformAspect: 1 }),
    [crop, onChange],
  )

  const setFreeformAspect = useCallback(
    (ratio: number) => onChange({ ...crop, freeformAspect: ratio }),
    [crop, onChange],
  )

  const rotate90 = useCallback(
    () => onChange({ ...crop, rotation: (crop.rotation + 90) % 360 }),
    [crop, onChange],
  )

  const toggleFlipH = useCallback(
    () => onChange({ ...crop, flipH: !crop.flipH }),
    [crop, onChange],
  )

  const toggleFlipV = useCallback(
    () => onChange({ ...crop, flipV: !crop.flipV }),
    [crop, onChange],
  )

  const setStraighten = useCallback(
    (r: number) => onChange({ ...crop, straighten: r }),
    [crop, onChange],
  )

  const reset = useCallback(
    () => {
      if (onReset) {
        onReset()
      } else {
        onChange({ ...DEFAULT_CROP, cropX: 0.5, cropY: 0.5 })
      }
    },
    [onReset, onChange],
  )

  return (
    <View style={styles.container}>
      {/* Ligne des outils : aspects + rotate + flip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsRow}
      >
        {ASPECT_OPTIONS.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setAspect(a.ratio)}
            style={[
              styles.toolBtn,
              crop.freeformAspect === undefined && crop.aspect === a.ratio && styles.toolBtnActive,
            ]}
          >
            <AspectGlyph kind={a.icon} active={crop.freeformAspect === undefined && crop.aspect === a.ratio} />
            <Text
              style={[
                styles.toolLabel,
                crop.freeformAspect === undefined && crop.aspect === a.ratio && styles.toolLabelActive,
              ]}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}

        <Pressable
          onPress={enableFreeform}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11yFreeCrop}
          style={[styles.toolBtn, crop.freeformAspect !== undefined && styles.toolBtnActive]}
        >
          <AspectGlyph kind="free" active={crop.freeformAspect !== undefined} />
          <Text style={[styles.toolLabel, crop.freeformAspect !== undefined && styles.toolLabelActive]}>
            {t.news.compose.editorFreeCrop}
          </Text>
        </Pressable>

        <Pressable onPress={rotate90} style={styles.toolBtn}>
          <Ionicons name="refresh" size={26} color={createColors.textSecondary} />
          <Text style={styles.toolLabel}>Tourner</Text>
        </Pressable>

        <Pressable
          onPress={toggleFlipH}
          style={[styles.toolBtn, crop.flipH && styles.toolBtnActive]}
        >
          <Ionicons
            name="swap-horizontal"
            size={26}
            color={crop.flipH ? createColors.accent : createColors.textSecondary}
          />
          <Text
            style={[
              styles.toolLabel,
              crop.flipH && styles.toolLabelActive,
            ]}
          >
            Retourner H
          </Text>
        </Pressable>

        <Pressable
          onPress={toggleFlipV}
          style={[styles.toolBtn, crop.flipV && styles.toolBtnActive]}
        >
          <Ionicons
            name="swap-vertical"
            size={26}
            color={crop.flipV ? createColors.accent : createColors.textSecondary}
          />
          <Text
            style={[
              styles.toolLabel,
              crop.flipV && styles.toolLabelActive,
            ]}
          >
            Retourner V
          </Text>
        </Pressable>
      </ScrollView>

      {crop.freeformAspect !== undefined ? (
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>{t.news.compose.editorFormat}</Text>
          <StraightenSlider
            value={crop.freeformAspect}
            min={FREEFORM_ASPECT_MIN}
            max={FREEFORM_ASPECT_MAX}
            step={0.01}
            centered={false}
            onChange={setFreeformAspect}
          />
          <Text style={styles.resetText}>{crop.freeformAspect.toFixed(2)}</Text>
        </View>
      ) : null}

      {/* Straighten slider */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Redresser</Text>
        <StraightenSlider
          value={crop.straighten ?? 0}
          min={-45}
          max={45}
          onChange={setStraighten}
        />
        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetText}>{Math.round(crop.straighten ?? 0)}°</Text>
        </Pressable>
      </View>
    </View>
  )
})

/* ── Aspect glyph (icône SVG simplifiée) ───────────────────────── */

function AspectGlyph({ kind, active }: { kind: string; active: boolean }) {
  const color = active ? createColors.accent : createColors.textSecondary
  const size = 26

  if (kind === 'free') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="crop-outline" size={24} color={color} />
      </View>
    )
  }

  const dims: Record<string, [number, number]> = {
    square: [16, 16],
    portrait: [13, 20],
    landscape: [20, 11],
    wide: [22, 10],
  }
  const [w, h] = dims[kind] ?? [16, 16]

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 2,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  toolsRow: {
    paddingHorizontal: 4,
    gap: 2,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 56,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toolLabel: {
    fontSize: 11,
    color: createColors.textSecondary,
  },
  toolLabelActive: {
    color: createColors.accent,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 11,
    color: createColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 72,
  },
  resetBtn: {
    width: 40,
    alignItems: 'flex-end',
  },
  resetText: {
    fontSize: 11,
    color: createColors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
})
