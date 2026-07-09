/* FeedTabsScreen — swipe horizontal entre "Pour toi" et "Suivi".
   Rôle : PagerView pré-monte les 2 FeedScreen pour swipe instantané.
   Header animé synchronisé via scrollPosition (Animated.Value interpolé).
   Gère le throttling des logs de debug. */

import { useRef, useState, useCallback } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import PagerView from 'react-native-pager-view'
import FeedScreen from './FeedScreen'
import FeedTabsHeader from './components/FeedTabsHeader'
import { FEED_DEBUG } from './store/feedStore'

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView)

interface FeedTabsScreenProps {
  isTabFocused?: boolean
}

export default function FeedTabsScreen({ isTabFocused = true }: FeedTabsScreenProps) {
  const scrollPosition = useRef(new Animated.Value(0)).current
  const [activeTab, setActiveTab] = useState<0 | 1>(0)
  const lastScrollLog = useRef(0)
  const activeTabRef = useRef<0 | 1>(0)

  const handlePageScroll = useCallback(
    (e: { nativeEvent: { position: number; offset: number } }) => {
      const { position, offset } = e.nativeEvent
      const value = position + offset
      scrollPosition.setValue(value)

      // bascule activeTab à 50% du swipe pour que l'ancien onglet ait le temps de pause()
      if (value > 0.5 && activeTabRef.current !== 1) {
        activeTabRef.current = 1
        setActiveTab(1)
      } else if (value <= 0.5 && activeTabRef.current !== 0) {
        activeTabRef.current = 0
        setActiveTab(0)
      }

      if (FEED_DEBUG) {
        const now = Date.now()
        if (now - lastScrollLog.current > 100) {
          lastScrollLog.current = now
          console.log('[FEED_DEBUG] TABS: scroll position →', value.toFixed(2))
        }
      }
    },
    [scrollPosition],
  )

  const handlePageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    const page = e.nativeEvent.position
    activeTabRef.current = page as 0 | 1
    setActiveTab(page as 0 | 1)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] TABS: page selected →', page)
  }, [])

  const handleTabPress = useCallback((index: 0 | 1) => {
    activeTabRef.current = index
    setActiveTab(index)
    pagerRef.current?.setPage(index)
  }, [])

  const pagerRef = useRef<PagerView>(null)

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPagerView
        ref={pagerRef}
        style={StyleSheet.absoluteFill}
        initialPage={0}
        overdrag={false}
        onPageScroll={handlePageScroll}
        onPageSelected={handlePageSelected}
      >
        <View key="forYou" style={{ width: '100%', height: '100%' }}>
          <FeedScreen feedType="forYou" isActive={isTabFocused && activeTab === 0} />
        </View>
        <View key="following" style={{ width: '100%', height: '100%' }}>
          <FeedScreen feedType="following" isActive={isTabFocused && activeTab === 1} />
        </View>
      </AnimatedPagerView>
      <FeedTabsHeader scrollPosition={scrollPosition} onTabPress={handleTabPress} />
    </View>
  )
}
