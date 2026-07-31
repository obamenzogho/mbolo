import React, { createContext, useContext, useState, useCallback } from 'react'

interface TabBarVisibilityContextValue {
  isTabBarHidden: boolean
  hideTabBar: () => void
  showTabBar: () => void
  feedBottomBarBg: string
  setFeedBottomBarBg: (bg: string) => void
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  isTabBarHidden: false,
  hideTabBar: () => {},
  showTabBar: () => {},
  feedBottomBarBg: 'transparent',
  setFeedBottomBarBg: () => {},
})

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext)
}

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isTabBarHidden, setIsTabBarHidden] = useState(false)
  const [feedBottomBarBg, setFeedBottomBarBg] = useState('transparent')
  const hideTabBar = useCallback(() => setIsTabBarHidden(true), [])
  const showTabBar = useCallback(() => setIsTabBarHidden(false), [])

  return (
    <TabBarVisibilityContext.Provider value={{ isTabBarHidden, hideTabBar, showTabBar, feedBottomBarBg, setFeedBottomBarBg }}>
      {children}
    </TabBarVisibilityContext.Provider>
  )
}
