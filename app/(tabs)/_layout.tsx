import { Tabs } from 'expo-router'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import BottomTabBar from '@/components/ui/BottomTabBar'
import { CreateModalProvider } from '@/contexts/CreateModalContext'
import { TabBarVisibilityProvider } from '@/contexts/TabBarVisibilityContext'

export default function TabsLayout() {
  return (
    <CreateModalProvider>
      <TabBarVisibilityProvider>
        <Tabs
          screenOptions={{ headerShown: false, animation: 'none', lazy: true }}
          tabBar={(props: BottomTabBarProps) => <BottomTabBar {...props} />}
        >
          <Tabs.Screen name="stories" />
          <Tabs.Screen name="messages" />
          <Tabs.Screen name="feed" />
          <Tabs.Screen name="notifications" />
          <Tabs.Screen name="profile" />
          <Tabs.Screen name="(sub)" options={{ href: null }} />
        </Tabs>
      </TabBarVisibilityProvider>
    </CreateModalProvider>
  )
}
