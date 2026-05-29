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

  const handlePageScroll = useCallback(
    (e: { nativeEvent: { position: number; offset: number } }) => {
      const { position, offset } = e.nativeEvent
      const value = position + offset
      scrollPosition.setValue(value)

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
    setActiveTab(page as 0 | 1)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] TABS: page selected →', page)
  }, [])

  const handleTabPress = useCallback((index: 0 | 1) => {
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
        <View key="forYou" style={StyleSheet.absoluteFill}>
          <FeedScreen feedType="forYou" isActive={isTabFocused && activeTab === 0} />
        </View>
        <View key="following" style={StyleSheet.absoluteFill}>
          <FeedScreen feedType="following" isActive={isTabFocused && activeTab === 1} />
        </View>
      </AnimatedPagerView>
      <FeedTabsHeader scrollPosition={scrollPosition} onTabPress={handleTabPress} />
    </View>
  )
}
