import React, { useCallback } from 'react'
import { View, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { useHaptics } from '../../hooks/useHaptics'
import TabItem from './TabItem'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'

const VISIBLE_TABS = [
  'stories',
  'messages',
  'feed',
  'notifications',
  'profile',
] as const

type TabName = (typeof VISIBLE_TABS)[number]

const TAB_ICONS: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  stories: 'albums',
  messages: 'chatbubbles',
  feed: 'home',
  notifications: 'notifications',
  profile: 'person',
}

const TAB_LABELS: Record<TabName, string> = {
  stories: 'Stories',
  messages: 'Messages',
  feed: 'Accueil',
  notifications: 'Notifications',
  profile: 'Profil',
}

const BottomTabBar = React.memo(function BottomTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { lightImpact } = useHaptics()

  const activeRouteName = state.routes[state.index]?.name
  const isFeed = activeRouteName === 'feed'

  const handleTabPress = useCallback(
    (routeName: string, routeIndex: number) => {
      lightImpact()
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[routeIndex].key,
        canPreventDefault: true,
      })
      if (!event.defaultPrevented) {
        navigation.navigate(routeName)
      }
    },
    [navigation, state.routes, lightImpact],
  )

  if (!(VISIBLE_TABS as readonly string[]).includes(activeRouteName)) {
    return null
  }

  const screenWidth = Dimensions.get('window').width
  const itemWidth = screenWidth / VISIBLE_TABS.length

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: isFeed ? 'transparent' : 'rgba(13, 17, 23, 0.92)',
        borderTopWidth: 0.5,
        borderTopColor: isFeed ? 'transparent' : colors.border,
        paddingTop: 8,
        paddingBottom: insets.bottom + 4,
        height: 64 + insets.bottom,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: isFeed ? 0 : 0.3,
        shadowRadius: 8,
        elevation: isFeed ? 0 : 10,
        zIndex: 10,
      }}
    >
      {state.routes
        .filter((route: { name: string }) =>
          (VISIBLE_TABS as readonly string[]).includes(route.name),
        )
        .map((route: { key: string; name: string }, index: number) => {
          const tabName = route.name as TabName
          const isActive = route.name === activeRouteName

          return (
            <View
              key={route.key}
              style={{
                width: itemWidth,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TabItem
                icon={TAB_ICONS[tabName]}
                label={TAB_LABELS[tabName]}
                isActive={isActive}
                onPress={() => handleTabPress(route.name, index)}
              />
            </View>
          )
        })}
    </View>
  )
}, (prev, next) => {
  return prev.state.index === next.state.index
})

export default BottomTabBar
