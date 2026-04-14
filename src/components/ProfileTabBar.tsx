import { useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'
import type { ProfileTab } from '@/types'

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
}

export function ProfileTabBar({ tabs, activeTab, onTabChange }: ProfileTabBarProps) {
  const handlePress = useCallback((key: ProfileTab) => {
    onTabChange(key)
  }, [onTabChange])

  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#222' }}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => handlePress(tab)}
          style={{ flex: 1, alignItems: 'flex-start', paddingVertical: 10, paddingLeft: 12 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name={TAB_ICONS[tab]}
              size={22}
              color={activeTab === tab ? colors.white : '#555'}
            />
            {tab === 'grid' && (
              <>
                <Text style={{ color: colors.white, fontSize: 15, fontWeight: '800' }}>Publications</Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={colors.primary}
                />
              </>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}
