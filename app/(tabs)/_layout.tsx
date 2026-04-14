import { Tabs } from 'expo-router'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import BottomTabBar from '../../src/components/ui/BottomTabBar'
import { CreateModalProvider } from '../../src/contexts/CreateModalContext'
import { TabBarVisibilityProvider } from '../../src/contexts/TabBarVisibilityContext'

export default function TabsLayout() {
  return (
    <CreateModalProvider>
      <TabBarVisibilityProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            lazy: true,
          }}
          tabBar={(props: BottomTabBarProps) => <BottomTabBar {...props} />}
        >
          <Tabs.Screen name="stories" />
          <Tabs.Screen name="messages" />
          <Tabs.Screen name="feed" />
          <Tabs.Screen name="notifications" />
          <Tabs.Screen name="profile" />
          <Tabs.Screen name="discover" options={{ href: null }} />
          <Tabs.Screen name="explore" options={{ href: null }} />
          <Tabs.Screen name="upload" options={{ href: null }} />
          <Tabs.Screen name="edit-profile" options={{ href: null }} />
          <Tabs.Screen name="story-upload" options={{ href: null }} />
          <Tabs.Screen name="reel-upload" options={{ href: null }} />
          <Tabs.Screen name="camera" options={{ href: null }} />
          <Tabs.Screen name="video-editor" options={{ href: null }} />
        </Tabs>
      </TabBarVisibilityProvider>
    </CreateModalProvider>
  )
}
