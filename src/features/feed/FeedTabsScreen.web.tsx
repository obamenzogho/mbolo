/* FeedTabsScreen.web — version web sans PagerView (natif uniquement).
   Affiche la page active conditionnellement, avec animation du header
   synchronisée via Animated.timing sur scrollPosition. */

import { useRef, useState, useCallback } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import FeedScreen from './FeedScreen'
import LocalExploreScreen from './LocalExploreScreen'
import FeedTabsHeader from './components/FeedTabsHeader'
import NewsFeedScreen from '../news/NewsFeedScreen'
import { ConnectionBanner } from './components/ConnectionBanner'
import { FEED_DEBUG } from './store/feedStore'
import { useUserLocation } from '../location/useUserLocation'

type FeedTabIndex = 0 | 1 | 2 | 3
const DEFAULT_TAB: FeedTabIndex = 1
const ANIM_DURATION = 250

interface FeedTabsScreenProps {
  isTabFocused?: boolean
}

export default function FeedTabsScreen({ isTabFocused = true }: FeedTabsScreenProps) {
  const scrollPosition = useRef(new Animated.Value(DEFAULT_TAB)).current
  const [activeTab, setActiveTab] = useState<FeedTabIndex>(DEFAULT_TAB)
  const [isSwiping, setIsSwiping] = useState(false)
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  const { place, status, request } = useUserLocation()

  const handleTabPress = useCallback((index: FeedTabIndex) => {
    animRef.current?.stop()

    animRef.current = Animated.timing(scrollPosition, {
      toValue: index,
      duration: ANIM_DURATION,
      useNativeDriver: false,
    })

    animRef.current.start(() => {
      setActiveTab(index)
      setIsSwiping(false)
      if (FEED_DEBUG) console.log('[FEED_DEBUG] TABS: animated to', index)
    })

    setIsSwiping(true)
  }, [scrollPosition])

  const stable = isTabFocused && !isSwiping
  const forYouActive = stable && activeTab === 1
  const followingActive = stable && activeTab === 2
  const newsActive = stable && activeTab === 3

  const cityLabel = place?.city ?? 'À proximité'
  const hasPreciseLocation = place != null && status === 'granted'

  return (
    <View style={styles.container}>
      <View style={styles.pages}>
        {activeTab === 0 && (
          <LocalExploreScreen place={place} cityLabel={cityLabel} />
        )}
        {activeTab === 1 && (
          <FeedScreen feedType="forYou" isActive={forYouActive} />
        )}
        {activeTab === 2 && (
          <FeedScreen feedType="following" isActive={followingActive} />
        )}
        {activeTab === 3 && (
          <NewsFeedScreen isActive={newsActive} />
        )}
      </View>
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
  pages: { flex: 1 },
})
