/* CropTab.tsx — Onglet Crop de l'éditeur.

   Rapports d'aspect (Original, 1:1, 4:5, 1.91:1, 16:9),
   rotation 90°, flip H/V, straighten slider (-45°..45°). */

import { memo, useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { CropState } from '../../types/editing'
import { ASPECT_OPTIONS, DEFAULT_CROP } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { StraightenSlider } from './StraightenSlider'

interface CropTabProps {
  crop: CropState
  onChange: (crop: CropState) => void
}

export const CropTab = memo(function CropTab({ crop, onChange }: CropTabProps) {
  const setAspect = useCallback(
    (ratio: number) => onChange({ ...crop, aspect: ratio }),
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

  const setRotation = useCallback(
    (r: number) => onChange({ ...crop, rotation: r }),
    [crop, onChange],
  )

  const reset = useCallback(
    () => onChange({ ...DEFAULT_CROP }),
    [onChange],
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
              crop.aspect === a.ratio && styles.toolBtnActive,
            ]}
          >
            <AspectGlyph kind={a.icon} active={crop.aspect === a.ratio} />
            <Text
              style={[
                styles.toolLabel,
                crop.aspect === a.ratio && styles.toolLabelActive,
              ]}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}

        <Pressable onPress={rotate90} style={styles.toolBtn}>
          <Ionicons name="refresh" size={20} color={createColors.textSecondary} />
          <Text style={styles.toolLabel}>Rotate</Text>
        </Pressable>

        <Pressable
          onPress={toggleFlipH}
          style={[styles.toolBtn, crop.flipH && styles.toolBtnActive]}
        >
          <Ionicons
            name="swap-horizontal"
            size={20}
            color={crop.flipH ? createColors.accent : createColors.textSecondary}
          />
          <Text
            style={[
              styles.toolLabel,
              crop.flipH && styles.toolLabelActive,
            ]}
          >
            Flip H
          </Text>
        </Pressable>

        <Pressable
          onPress={toggleFlipV}
          style={[styles.toolBtn, crop.flipV && styles.toolBtnActive]}
        >
          <Ionicons
            name="swap-vertical"
            size={20}
            color={crop.flipV ? createColors.accent : createColors.textSecondary}
          />
          <Text
            style={[
              styles.toolLabel,
              crop.flipV && styles.toolLabelActive,
            ]}
          >
            Flip V
          </Text>
        </Pressable>
      </ScrollView>

      {/* Straighten slider */}
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Straighten</Text>
        <StraightenSlider
          value={crop.rotation}
          min={-45}
          max={45}
          onChange={setRotation}
        />
        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetText}>{Math.round(crop.rotation)}°</Text>
        </Pressable>
      </View>
    </View>
  )
})

/* ── Aspect glyph (icône SVG simplifiée) ───────────────────────── */

function AspectGlyph({ kind, active }: { kind: string; active: boolean }) {
  const color = active ? createColors.accent : createColors.textSecondary
  const size = 20

  if (kind === 'free') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="crop-outline" size={18} color={color} />
      </View>
    )
  }

  const dims: Record<string, [number, number]> = {
    square: [14, 14],
    portrait: [11, 17],
    landscape: [17, 9],
    wide: [18, 8],
  }
  const [w, h] = dims[kind] ?? [14, 14]

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
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 52,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toolLabel: {
    fontSize: 10,
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
