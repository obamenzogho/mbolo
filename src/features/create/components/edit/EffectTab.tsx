/* EffectTab.tsx — Onglet Effect de l'éditeur.

   12 effets avec overlays (grain, leak, prism) et slider d'intensité. */

import { memo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { EFFECTS } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { StraightenSlider } from './StraightenSlider'

interface EffectTabProps {
  imageUri: string
  effectId: string
  effectIntensity: number
  onEffectChange: (id: string) => void
  onIntensityChange: (n: number) => void
}

export const EffectTab = memo(function EffectTab({
  imageUri,
  effectId,
  effectIntensity,
  onEffectChange,
  onIntensityChange,
}: EffectTabProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {EFFECTS.map((e) => {
          const active = e.id === effectId
          return (
            <Pressable
              key={e.id}
              onPress={() => onEffectChange(e.id)}
              style={styles.item}
            >
              <View style={[styles.thumb, active && styles.thumbActive]}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.thumbImage}
                  contentFit="cover"
                  transition={0}
                />
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>
                {e.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {effectId !== 'ef-none' ? (
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Puissance</Text>
          <StraightenSlider
            value={effectIntensity}
            min={0}
            max={100}
            onChange={onIntensityChange}
          />
          <Text style={styles.sliderValue}>{effectIntensity}</Text>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { gap: 8 },
  list: { paddingHorizontal: 4, gap: 10 },
  item: { alignItems: 'center', gap: 3 },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: createColors.textPrimary },
  thumbImage: { width: '100%', height: '100%' },
  label: { fontSize: 11, color: createColors.textSecondary },
  labelActive: { color: createColors.textPrimary },
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
    width: 64,
  },
  sliderValue: {
    fontSize: 11,
    color: createColors.textSecondary,
    width: 32,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
})
