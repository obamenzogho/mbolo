import React, { memo, useCallback } from 'react'
import { View, TouchableOpacity, Text, Alert, LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, SharedValue, interpolate } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import CreateButton from '../../../components/create/CreateButton'

const INDICATOR_WIDTH = 28

interface FeedTopBarProps {
  pageScrollPos: SharedValue<number>
  onTabPress: (page: number) => void
  onClearSeen?: () => void
  onOpenCreate?: () => void
}

function FeedTopBarComponent({ pageScrollPos, onTabPress, onClearSeen, onOpenCreate }: FeedTopBarProps) {
  const insets = useSafeAreaInsets()
  const tab0X = useSharedValue(0)
  const tab0W = useSharedValue(80)
  const tab1X = useSharedValue(0)
  const tab1W = useSharedValue(50)

  const onTab0Layout = useCallback((e: LayoutChangeEvent) => {
    tab0X.value = e.nativeEvent.layout.x
    tab0W.value = e.nativeEvent.layout.width
  }, [tab0X, tab0W])

  const onTab1Layout = useCallback((e: LayoutChangeEvent) => {
    tab1X.value = e.nativeEvent.layout.x
    tab1W.value = e.nativeEvent.layout.width
  }, [tab1X, tab1W])

  const indicatorStyle = useAnimatedStyle(() => {
    const left = interpolate(pageScrollPos.value, [0, 1], [tab0X.value, tab1X.value])
    const width = interpolate(pageScrollPos.value, [0, 1], [tab0W.value, tab1W.value])
    return {
      left: left + (width - INDICATOR_WIDTH) / 2,
      width: INDICATOR_WIDTH,
    }
  })

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: 'transparent',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/explore')}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="search" size={16} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
          <TouchableOpacity
            onPress={() => onTabPress(0)}
            onLongPress={() => {
              if (onClearSeen) {
                Alert.alert(
                  'Réinitialiser',
                  'Effacer l\'historique des vidéos vues ?\nElles réapparaîtront dans le feed.',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'OK', onPress: onClearSeen },
                  ],
                )
              }
            }}
            onLayout={onTab0Layout}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.white }}>
              Quoi de neuf
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onTabPress(1)} onLayout={onTab1Layout}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.white }}>
              Suivi
            </Text>
          </TouchableOpacity>
          <Animated.View style={[{
            position: 'absolute', bottom: -6,
            height: 3, backgroundColor: colors.primary, borderRadius: 1.5,
          }, indicatorStyle]} />
        </View>
        <CreateButton onPress={() => onOpenCreate?.()} />
      </View>
    </View>
  )
}

export const FeedTopBar = memo(FeedTopBarComponent)
