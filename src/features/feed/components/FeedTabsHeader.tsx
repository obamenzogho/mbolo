/* FeedTabsHeader — header flottant "Pour toi / Suivi".
   Rôle : affiche les deux onglets avec indicateur animé
   synchronisé au geste via scrollPosition (0 → pour toi, 1 → suivi).
   Positionné en absolute top, centré horizontalement. */

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

const TAB_GAP = 32

interface FeedTabsHeaderProps {
  scrollPosition: Animated.Value
  onTabPress: (index: 0 | 1) => void
}

export default function FeedTabsHeader({ scrollPosition, onTabPress }: FeedTabsHeaderProps) {
  const insets = useSafeAreaInsets()
  const { openCreateModal } = useCreateModal()

  const [labelWidths, setLabelWidths] = useState({ forYou: 0, following: 0 })
  const [labelPositions, setLabelPositions] = useState({ forYou: 0, following: 0 })

  const handleLayout0 = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    setLabelWidths((prev) => ({ ...prev, forYou: width }))
    setLabelPositions((prev) => ({ ...prev, forYou: x }))
  }, [])

  const handleLayout1 = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    setLabelWidths((prev) => ({ ...prev, following: width }))
    setLabelPositions((prev) => ({ ...prev, following: x }))
  }, [])

  const indicatorX = useMemo(
    () =>
      scrollPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [labelPositions.forYou, labelPositions.following],
      }),
    [scrollPosition, labelPositions],
  )

  const indicatorWidth = useMemo(
    () =>
      scrollPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [labelWidths.forYou || 40, labelWidths.following || 40],
      }),
    [scrollPosition, labelWidths],
  )

  const forYouOpacity = useMemo(
    () =>
      scrollPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.5],
      }),
    [scrollPosition],
  )

  const followingOpacity = useMemo(
    () =>
      scrollPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [0.5, 1],
      }),
    [scrollPosition],
  )

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
            justifyContent: 'center',
            alignItems: 'center',
            gap: TAB_GAP,
          }}
        >
          <TouchableOpacity
            onLayout={handleLayout0}
            onPress={() => onTabPress(0)}
            activeOpacity={0.7}
          >
            <Animated.Text
              style={{
                color: '#fff',
                fontSize: 15,
                fontWeight: '700',
                letterSpacing: 0.3,
                opacity: forYouOpacity,
              }}
            >
              Pour toi
            </Animated.Text>
          </TouchableOpacity>
          <TouchableOpacity
            onLayout={handleLayout1}
            onPress={() => onTabPress(1)}
            activeOpacity={0.7}
          >
            <Animated.Text
              style={{
                color: '#fff',
                fontSize: 15,
                fontWeight: '700',
                letterSpacing: 0.3,
                opacity: followingOpacity,
              }}
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
        onPress={() => router.push('/search')}
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
