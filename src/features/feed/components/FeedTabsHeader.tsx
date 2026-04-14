/* FeedTabsHeader — header flottant "[Ville] / Pour toi / Suivi".
   Rôle : affiche les trois onglets avec indicateur animé synchronisé au geste
   via scrollPosition (0 → ville, 1 → pour toi, 2 → suivi). Le 1er onglet porte
   comme libellé la ville actuelle de l'utilisateur (ou « À proximité » tant que
   la localisation n'est pas connue). Positionné en absolute top, centré. */

import { useMemo, useState, useCallback } from 'react'
import {
  Animated,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCreateModal } from '../../../contexts/CreateModalContext'
import { router } from 'expo-router'

const TAB_GAP = 20

type TabIndex = 0 | 1 | 2

interface FeedTabsHeaderProps {
  scrollPosition: Animated.Value
  onTabPress: (index: TabIndex) => void
  cityLabel: string
  locationGranted: boolean
  onRequestLocation: () => void
}

export default function FeedTabsHeader({
  scrollPosition, onTabPress, cityLabel, locationGranted, onRequestLocation,
}: FeedTabsHeaderProps) {
  const insets = useSafeAreaInsets()
  const { openCreateModal } = useCreateModal()

  // Layout (x + largeur) de chaque libellé, mesuré à la volée.
  const [widths, setWidths] = useState<[number, number, number]>([0, 0, 0])
  const [positions, setPositions] = useState<[number, number, number]>([0, 0, 0])

  const onLayoutFor = useCallback((i: TabIndex) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    setWidths((prev) => { const n = [...prev] as [number, number, number]; n[i] = width; return n })
    setPositions((prev) => { const n = [...prev] as [number, number, number]; n[i] = x; return n })
  }, [])

  const indicatorX = useMemo(
    () => scrollPosition.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [positions[0], positions[1], positions[2]],
    }),
    [scrollPosition, positions],
  )

  const indicatorWidth = useMemo(
    () => scrollPosition.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [widths[0] || 40, widths[1] || 40, widths[2] || 40],
    }),
    [scrollPosition, widths],
  )

  // Opacité de chaque onglet : plein quand sélectionné, atténué sinon.
  const opacityFor = useCallback((i: TabIndex) => scrollPosition.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [i === 0 ? 1 : 0.5, i === 1 ? 1 : 0.5, i === 2 ? 1 : 0.5],
  }), [scrollPosition])

  const handleCityPress = useCallback(() => {
    // Si la localisation n'est pas encore accordée, on la (re)demande ;
    // sinon on bascule simplement sur l'onglet ville.
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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: TAB_GAP,
            paddingLeft: 16,
            // Réserve la zone des icônes recherche/créer (à droite) pour que les
            // onglets ne passent jamais dessous.
            paddingRight: 104,
          }}
        >
          {/* Onglet ville */}
          <TouchableOpacity onLayout={onLayoutFor(0)} onPress={handleCityPress} activeOpacity={0.7}>
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: opacityFor(0) }}>
              <Ionicons name="location-sharp" size={13} color="#fff" />
              <Animated.Text
                numberOfLines={1}
                style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3, maxWidth: 100 }}
              >
                {cityLabel}
              </Animated.Text>
            </Animated.View>
          </TouchableOpacity>

          {/* Onglet Pour toi */}
          <TouchableOpacity onLayout={onLayoutFor(1)} onPress={() => onTabPress(1)} activeOpacity={0.7}>
            <Animated.Text
              style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3, opacity: opacityFor(1) }}
            >
              Pour toi
            </Animated.Text>
          </TouchableOpacity>

          {/* Onglet Suivi */}
          <TouchableOpacity onLayout={onLayoutFor(2)} onPress={() => onTabPress(2)} activeOpacity={0.7}>
            <Animated.Text
              style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3, opacity: opacityFor(2) }}
            >
              Suivi
            </Animated.Text>
          </TouchableOpacity>
        </View>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 2,
            borderRadius: 2,
            backgroundColor: '#00C853',
            width: indicatorWidth,
            transform: [{ translateX: indicatorX }],
          }}
        />
      </LinearGradient>

      <TouchableOpacity
        onPress={() => router.push({ pathname: '/(tabs)/explore', params: { from: '/(tabs)/feed' } })}
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
