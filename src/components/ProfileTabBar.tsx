import { useCallback, useEffect, useRef } from 'react'
import { View, TouchableOpacity, LayoutChangeEvent } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, type SharedValue } from 'react-native-reanimated'
import { colors } from '@/lib/theme'
import type { ProfileTab } from '@/types'

const INDICATOR_WIDTH = 24

const TAB_ICONS: Record<ProfileTab, keyof typeof Ionicons.glyphMap> = {
  saved: 'bookmark-outline',
  liked: 'heart-outline',
  grid: 'grid-outline',
  reels: 'film-outline',
  reposted: 'repeat-outline',
  tagged: 'pricetag-outline',
}

interface ProfileTabBarProps {
  tabs: ProfileTab[]
  activeTab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
  setActiveTab?: (tab: ProfileTab) => void
  swipeOffsetPx?: SharedValue<number>
}

export function ProfileTabBar({ tabs, activeTab, onTabChange, swipeOffsetPx }: ProfileTabBarProps) {
  const indicatorLeft = useSharedValue(0)
  const indicatorWidth = useSharedValue(0)
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({})

  const activeIndex = tabs.findIndex(t => t === activeTab)

  useEffect(() => {
    const layout = tabLayouts.current[activeTab]
    if (layout) {
      indicatorLeft.value = withSpring(layout.x + (layout.width - INDICATOR_WIDTH) / 2, { damping: 20, stiffness: 200 })
      indicatorWidth.value = withSpring(INDICATOR_WIDTH, { damping: 20, stiffness: 200 })
    }
  }, [activeTab, tabs, indicatorLeft, indicatorWidth])

  const onTabLayout = useCallback((key: ProfileTab, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    tabLayouts.current[key] = { x, width }
    if (tabs[activeIndex] === key) {
      indicatorLeft.value = x + (width - INDICATOR_WIDTH) / 2
      indicatorWidth.value = INDICATOR_WIDTH
    }
  }, [activeIndex, tabs, indicatorLeft, indicatorWidth])

  const handlePress = useCallback((key: ProfileTab) => {
    onTabChange(key)
    const layout = tabLayouts.current[key]
    if (layout) {
      indicatorLeft.value = withSpring(layout.x + (layout.width - INDICATOR_WIDTH) / 2, { damping: 20, stiffness: 200 })
      indicatorWidth.value = withSpring(INDICATOR_WIDTH, { damping: 20, stiffness: 200 })
    }
  }, [onTabChange, indicatorLeft, indicatorWidth])

  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorLeft.value + (swipeOffsetPx?.value ?? 0),
    width: indicatorWidth.value,
  }))

  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#222', position: 'relative' }}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onLayout={(e) => onTabLayout(tab, e)}
          onPress={() => handlePress(tab)}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
        >
          <View>
            <Ionicons
              name={TAB_ICONS[tab]}
              size={22}
              color={activeTab === tab ? colors.white : '#555'}
            />
            {tab === 'grid' && (
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.primary}
                style={{ position: 'absolute', top: -8, right: -10 }}
              />
            )}
          </View>
        </TouchableOpacity>
      ))}
      <Reanimated.View
        style={[
          indicatorStyle,
          {
            position: 'absolute', bottom: 4, height: 3,
            backgroundColor: colors.primary, borderRadius: 2,
          },
        ]}
      />
    </View>
  )
}
