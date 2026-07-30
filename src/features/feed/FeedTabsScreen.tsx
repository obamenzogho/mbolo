/* FeedTabsScreen — swipe horizontal entre "Ville / Pour toi / Suivi / Actus".
   Rôle : PagerView pré-monte les 4 pages pour swipe instantané.
   Header animé synchronisé via scrollPosition (Animated.Value interpolé).
   « Pour toi » (index 1) est l'onglet par défaut à l'ouverture.
   isSwiping : pendant un swipe, AUCUN feed n'est actif. */

import { useRef, useState, useCallback } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import PagerView from 'react-native-pager-view'
import FeedScreen from './FeedScreen'
import LocalExploreScreen from './LocalExploreScreen'
import FeedTabsHeader from './components/FeedTabsHeader'
import NewsFeedScreen from '../news/NewsFeedScreen'
import { ConnectionBanner } from './components/ConnectionBanner'
import { FEED_DEBUG } from './store/feedStore'
import { useUserLocation } from '../location/useUserLocation'

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView)

type FeedTabIndex = 0 | 1 | 2 | 3
const DEFAULT_TAB: FeedTabIndex = 1

interface FeedTabsScreenProps {
  isTabFocused?: boolean
}

export default function FeedTabsScreen({ isTabFocused = true }: FeedTabsScreenProps) {
  const scrollPosition = useRef(new Animated.Value(DEFAULT_TAB)).current
  const [activeTab, setActiveTab] = useState<FeedTabIndex>(DEFAULT_TAB)
  const [isSwiping, setIsSwiping] = useState(false)
  const lastScrollLog = useRef(0)
  const pagerRef = useRef<PagerView>(null)

  const { place, status, request } = useUserLocation()

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

  const handlePageScrollStateChanged = useCallback(
    (e: { nativeEvent: { pageScrollState: 'idle' | 'dragging' | 'settling' } }) => {
      const state = e.nativeEvent.pageScrollState
      setIsSwiping(state !== 'idle')
      if (FEED_DEBUG) console.log('[FEED_DEBUG] TABS: scroll state →', state)
    },
    [],
  )

  const handlePageSelected = useCallback(
    (event: { nativeEvent: { position: number } }) => {
      setActiveTab(event.nativeEvent.position as FeedTabIndex)
    },
    [],
  )

  const handleTabPress = useCallback((index: FeedTabIndex) => {
    pagerRef.current?.setPage(index)
  }, [])

  const stable = isTabFocused && !isSwiping
  const forYouActive = stable && activeTab === 1
  const followingActive = stable && activeTab === 2
  const newsActive = stable && activeTab === 3

  const cityLabel = place?.city ?? 'À proximité'
  const hasPreciseLocation = place != null && status === 'granted'

  return (
    <View style={styles.container}>
      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={DEFAULT_TAB}
        offscreenPageLimit={1}
        onPageScroll={handlePageScroll}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        onPageSelected={handlePageSelected}
      >
        <View key="city" style={styles.page}>
          <LocalExploreScreen place={place} cityLabel={cityLabel} />
        </View>
        <View key="forYou" style={styles.page}>
          <FeedScreen feedType="forYou" isActive={forYouActive} />
        </View>
        <View key="following" style={styles.page}>
          <FeedScreen feedType="following" isActive={followingActive} />
        </View>
        <View key="news" style={styles.page}>
          <NewsFeedScreen isActive={newsActive} />
        </View>
      </AnimatedPagerView>
      <FeedTabsHeader
        scrollPosition={scrollPosition}
        onTabPress={handleTabPress}
        cityLabel={cityLabel}
        locationGranted={hasPreciseLocation}
        onRequestLocation={request}
      />
      <ConnectionBanner />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
})
