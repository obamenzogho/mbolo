/* AdjustTab.tsx — Onglet Edit (ajustements manuels) de l'éditeur.

   10 sliders : brightness, contrast, saturation, warmth, fade,
   highlights, shadows, tint, sharpen, vignette. */

import { memo, useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Adjustments } from '../../types/editing'
import { DEFAULT_ADJUSTMENTS } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { StraightenSlider } from './StraightenSlider'

interface AdjustTabProps {
  adjustments: Adjustments
  onChange: (adj: Adjustments) => void
}

const TOOLS: { id: keyof Adjustments; label: string; icon: keyof typeof Ionicons.glyphMap; min: number }[] = [
  { id: 'brightness', label: 'Bright', icon: 'sunny-outline', min: -100 },
  { id: 'contrast', label: 'Contrast', icon: 'contrast-outline', min: -100 },
  { id: 'saturation', label: 'Saturn', icon: 'color-fill-outline', min: -100 },
  { id: 'warmth', label: 'Warmth', icon: 'thermometer-outline', min: -100 },
  { id: 'fade', label: 'Fade', icon: 'water-outline', min: -100 },
  { id: 'highlights', label: 'Highlight', icon: 'flashlight-outline', min: -100 },
  { id: 'shadows', label: 'Shadow', icon: 'moon-outline', min: -100 },
  { id: 'tint', label: 'Tint', icon: 'color-palette-outline', min: -100 },
  { id: 'sharpen', label: 'Sharpen', icon: 'triangle-outline', min: -100 },
  { id: 'vignette', label: 'Vignette', icon: 'radio-button-off-outline', min: 0 },
]

export const AdjustTab = memo(function AdjustTab({
  adjustments,
  onChange,
}: AdjustTabProps) {
  const [activeTool, setActiveTool] = useState<keyof Adjustments>('brightness')

  const handleSliderChange = useCallback(
    (value: number) => {
      onChange({ ...adjustments, [activeTool]: value })
    },
    [adjustments, activeTool, onChange],
  )

  const resetTool = useCallback(() => {
    onChange({ ...adjustments, [activeTool]: 0 })
  }, [adjustments, activeTool, onChange])

  const currentValue = adjustments[activeTool]
  const tool = TOOLS.find((t) => t.id === activeTool)!

  return (
    <View style={styles.container}>
      {/* Ligne des outils */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsRow}
      >
        {TOOLS.map((t) => {
          const active = t.id === activeTool
          const val = adjustments[t.id]
          return (
            <Pressable
              key={t.id}
              onPress={() => setActiveTool(t.id)}
              style={styles.toolBtn}
            >
              <Ionicons
                name={t.icon}
                size={26}
                color={active ? createColors.textPrimary : createColors.textSecondary}
              />
              <Text
                style={[
                  styles.toolLabel,
                  active && styles.toolLabelActive,
                ]}
              >
                {t.label}
              </Text>
              {val !== 0 ? (
                <Text style={styles.toolValue}>
                  {val > 0 ? `+${val}` : val}
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Slider de l'outil actif */}
      <View style={styles.sliderRow}>
        <Pressable onPress={resetTool} style={styles.resetBtn}>
          <Text style={styles.sliderLabel}>{tool.label}</Text>
        </Pressable>
        <StraightenSlider
          value={currentValue}
          min={tool.min}
          max={100}
          onChange={handleSliderChange}
        />
        <Text style={styles.sliderValue}>
          {currentValue > 0 ? '+' : ''}{currentValue}
        </Text>
      </View>
    </View>
  )
})

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
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 56,
  },
  toolLabel: {
    fontSize: 11,
    color: createColors.textSecondary,
  },
  toolLabelActive: {
    color: createColors.textPrimary,
  },
  toolValue: {
    fontSize: 10,
    color: createColors.accent,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  resetBtn: {
    width: 64,
  },
  sliderLabel: {
    fontSize: 11,
    color: createColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sliderValue: {
    fontSize: 11,
    color: createColors.textSecondary,
    width: 40,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
})
