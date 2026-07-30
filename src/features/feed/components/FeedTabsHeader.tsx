/* FeedTabsHeader — header flottant "Ville / Pour toi / Suivi / Actus".
   Rôle : affiche les 4 onglets avec indicateur animé synchronisé au geste
   via scrollPosition. Le 1er onglet porte comme libellé la ville actuelle.
   Positionné en absolute top, centré. */

import { useMemo, useState, useCallback } from 'react'
import {
  Animated,
  TouchableOpacity,
  View,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCreateModal } from '../../../contexts/CreateModalContext'
import { router } from 'expo-router'

type TabIndex = 0 | 1 | 2 | 3

interface FeedTabsHeaderProps {
  scrollPosition: Animated.Value
  onTabPress: (index: TabIndex) => void
  cityLabel: string
  locationGranted: boolean
  onRequestLocation: () => void
}

const TAB_COUNT = 4
const TAB_GAP = 24

const labels = ['Ville', 'Pour toi', 'Suivi', 'Actus'] as const

export default function FeedTabsHeader({
  scrollPosition, onTabPress, cityLabel, locationGranted, onRequestLocation,
}: FeedTabsHeaderProps) {
  const insets = useSafeAreaInsets()
  const { openCreateModal } = useCreateModal()

  const [tabLayouts, setTabLayouts] = useState(
    Array.from({ length: TAB_COUNT }, () => ({ x: 0, width: 0 })),
  )

  const handleTabLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout
      setTabLayouts((previous) => {
        const next = [...previous]
        next[index] = { x, width }
        return next
      })
    },
    [],
  )

  const indicatorX = useMemo(
    () => scrollPosition.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: tabLayouts.map((tab) => tab.x),
      extrapolate: 'clamp',
    }),
    [scrollPosition, tabLayouts],
  )

  const indicatorWidth = useMemo(
    () => scrollPosition.interpolate({
      inputRange: [0, 1, 2, 3],
      outputRange: tabLayouts.map((tab) => tab.width || 40),
      extrapolate: 'clamp',
    }),
    [scrollPosition, tabLayouts],
  )

  const opacityFor = useCallback(
    (index: number) => scrollPosition.interpolate({
      inputRange: [
        Math.max(0, index - 1),
        index,
        Math.min(TAB_COUNT - 1, index + 1),
      ],
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    }),
    [scrollPosition],
  )

  const handleCityPress = useCallback(() => {
    if (!locationGranted) onRequestLocation()
    onTabPress(0)
  }, [locationGranted, onRequestLocation, onTabPress])

  return (
    <>
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top + 12,
          paddingBottom: 8,
        }}
        pointerEvents="box-none"
      >
        <View style={styles.tabsRow}>
          {labels.map((label, index) => {
            const visibleLabel = index === 0 && cityLabel ? cityLabel : label
            const onPress = index === 0 ? handleCityPress : () => onTabPress(index as TabIndex)

            return (
              <TouchableOpacity
                key={label}
                onLayout={handleTabLayout(index)}
                onPress={onPress}
                activeOpacity={0.7}
                style={styles.tabButton}
                accessibilityRole="tab"
              >
                <Animated.Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    { opacity: opacityFor(index) },
                  ]}
                >
                  {visibleLabel}
                </Animated.Text>
              </TouchableOpacity>
            )
          })}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: indicatorWidth,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
        </View>
      </LinearGradient>

      <TouchableOpacity
        onPress={() => router.push({ pathname: '/explore', params: { from: '/(tabs)/feed' } })}
        activeOpacity={0.7}
        style={{
          position: 'absolute',
          right: 60,
          top: insets.top + 10,
          width: 32,
          height: 32,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 11,
        }}
      >
        <Ionicons name="search-outline" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={openCreateModal}
        activeOpacity={0.7}
        style={{
          position: 'absolute',
          right: 16,
          top: insets.top + 10,
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: '#00C853',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 11,
        }}
      >
        <Ionicons name="add" size={22} color="#00C853" />
      </TouchableOpacity>
    </>
  )
}

const styles = StyleSheet.create({
  tabsRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: TAB_GAP,
    paddingLeft: 16,
    paddingRight: 86,
    paddingBottom: 8,
  },
  tabButton: {
    paddingHorizontal: 2,
    paddingVertical: 5,
    maxWidth: 92,
  },
  tabLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#00C853',
  },
})
