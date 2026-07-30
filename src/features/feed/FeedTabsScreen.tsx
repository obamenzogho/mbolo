import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  StyleSheet,
  View,
} from 'react-native'
import FeedScreen from './FeedScreen'
import LocalExploreScreen from './LocalExploreScreen'
import FeedTabsHeader from './components/FeedTabsHeader'
import FeedPager, {
  type FeedPagerIndex,
  type FeedPagerRef,
} from './components/FeedPager'
import NewsFeedScreen from '../news/NewsFeedScreen'
import { FEED_DEBUG } from './store/feedStore'
import { ConnectionBanner } from './components/ConnectionBanner'
import { useUserLocation } from '../location/useUserLocation'

const DEFAULT_TAB: FeedPagerIndex = 1

interface FeedTabsScreenProps {
  isTabFocused?: boolean
}

export default function FeedTabsScreen({
  isTabFocused = true,
}: FeedTabsScreenProps) {
  const scrollPosition = useRef(
    new Animated.Value(DEFAULT_TAB),
  ).current

  const headerTranslateY = useRef(
    new Animated.Value(0),
  ).current

  const pagerRef = useRef<FeedPagerRef>(null)
  const [activeTab, setActiveTab] =
    useState<FeedPagerIndex>(DEFAULT_TAB)
  const [isSwiping, setIsSwiping] = useState(false)
  const lastScrollLog = useRef(0)

  const {
    place,
    status,
    request,
  } = useUserLocation()

  const cityLabel = place?.city ?? 'À proximité'
  const locationGranted = status === 'granted'

  const handlePageScroll = useCallback(
    (event: {
      nativeEvent: {
        position: number
        offset: number
      }
    }) => {
      const { position, offset } = event.nativeEvent
      const value = position + offset

      scrollPosition.setValue(value)

      if (FEED_DEBUG) {
        const now = Date.now()

        if (now - lastScrollLog.current > 100) {
          lastScrollLog.current = now
          console.log(
            '[FEED_DEBUG] TABS: scroll position →',
            value.toFixed(2),
          )
        }
      }
    },
    [scrollPosition],
  )

  const handlePageSelected = useCallback(
    (event: {
      nativeEvent: {
        position: number
      }
    }) => {
      const page = Math.max(
        0,
        Math.min(3, event.nativeEvent.position),
      ) as FeedPagerIndex

      setActiveTab(page)
    },
    [],
  )

  const handlePageScrollStateChanged = useCallback(
    (event: {
      nativeEvent: {
        pageScrollState: 'idle' | 'dragging' | 'settling'
      }
    }) => {
      setIsSwiping(
        event.nativeEvent.pageScrollState !== 'idle',
      )
    },
    [],
  )

  const handleTabPress = useCallback(
    (index: FeedPagerIndex) => {
      pagerRef.current?.setPage(index)
    },
    [],
  )

  const handleNewsScrollDirection = useCallback(
    (direction: 'up' | 'down') => {
      if (activeTab !== 2) return

      Animated.timing(headerTranslateY, {
        toValue: direction === 'up' ? -120 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start()
    },
    [activeTab, headerTranslateY],
  )

  useEffect(() => {
    if (activeTab !== 2) {
      headerTranslateY.stopAnimation()
      headerTranslateY.setValue(0)
    }
  }, [activeTab, headerTranslateY])

  const stable = isTabFocused && !isSwiping

  const forYouActive = stable && activeTab === 1
  const newsActive = stable && activeTab === 2
  const followingActive = stable && activeTab === 3

  return (
    <View style={styles.container}>
      <FeedPager
        ref={pagerRef}
        initialPage={DEFAULT_TAB}
        onPageScroll={handlePageScroll}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handlePageScrollStateChanged}
      >
        <View key="city" style={styles.page}>
          <LocalExploreScreen place={place} cityLabel={cityLabel} />
        </View>

        <View key="for-you" style={styles.page}>
          <FeedScreen
            feedType="forYou"
            isActive={forYouActive}
          />
        </View>

        <View key="news" style={styles.page}>
          <NewsFeedScreen
            isActive={newsActive}
            onScrollDirection={handleNewsScrollDirection}
          />
        </View>

        <View key="following" style={styles.page}>
          <FeedScreen
            feedType="following"
            isActive={followingActive}
          />
        </View>
      </FeedPager>

      <FeedTabsHeader
        scrollPosition={scrollPosition}
        onTabPress={handleTabPress}
        cityLabel={cityLabel}
        locationGranted={locationGranted}
        onRequestLocation={request}
        isNewsActive={activeTab === 2}
        headerTranslateY={headerTranslateY}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
})
