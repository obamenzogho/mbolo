/* FilterTab.tsx — Onglet Filter de l'éditeur.

   14 filtres Instagram avec vignettes et slider d'intensité. */

import { memo, useCallback, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { FILTERS } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { StraightenSlider } from './StraightenSlider'

interface FilterTabProps {
  imageUri: string
  filterId: string
  filterIntensity: number
  onFilterChange: (id: string) => void
  onIntensityChange: (n: number) => void
}

export const FilterTab = memo(function FilterTab({
  imageUri,
  filterId,
  filterIntensity,
  onFilterChange,
  onIntensityChange,
}: FilterTabProps) {
  return (
    <View style={styles.container}>
      {/* Vignettes des filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {FILTERS.map((f) => {
          const active = f.id === filterId
          return (
            <Pressable
              key={f.id}
              onPress={() => onFilterChange(f.id)}
              style={styles.item}
            >
              <View
                style={[
                  styles.thumb,
                  active && styles.thumbActive,
                ]}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={styles.thumbImage}
                  contentFit="cover"
                  transition={0}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  active && styles.labelActive,
                ]}
              >
                {f.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Slider d'intensité */}
      {filterId !== 'none' ? (
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Intensity</Text>
          <StraightenSlider
            value={filterIntensity}
            min={0}
            max={100}
            onChange={onIntensityChange}
          />
          <Text style={styles.sliderValue}>{filterIntensity}</Text>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { gap: 8 },
  list: {
    paddingHorizontal: 4,
    gap: 10,
  },
  item: {
    alignItems: 'center',
    gap: 3,
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {
    borderColor: createColors.textPrimary,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 11,
    color: createColors.textSecondary,
  },
  labelActive: {
    color: createColors.textPrimary,
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
