/* FeedTabsScreen — swipe horizontal entre "Pour toi" et "Suivi".
   Rôle : PagerView pré-monte les 2 FeedScreen pour swipe instantané.
   Header animé synchronisé via scrollPosition (Animated.Value interpolé).
   Gère le throttling des logs de debug.
   isSwiping : pendant un swipe, AUCUN feed n'est actif → les deux pools se
   coupent (setActive(false)). Le feed cible ne (re)joue qu'une fois le geste
   terminé, ce qui empêche les deux onglets de jouer simultanément. */

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
  const [isSwiping, setIsSwiping] = useState(false)
  const lastScrollLog = useRef(0)
  const pagerRef = useRef<PagerView>(null)

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
      // Dès qu'un swipe commence (dragging) ou se termine (settling), on
      // considère qu'aucun onglet n'est stable → les deux feeds se mettent en
      // pause. On ne réactive le feed cible qu'au retour à 'idle'.
      setIsSwiping(state !== 'idle')
      if (FEED_DEBUG) console.log('[FEED_DEBUG] TABS: scroll state →', state)
    },
    [],
  )

  const handlePageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    const page = e.nativeEvent.position
    setActiveTab(page as 0 | 1)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] TABS: page selected →', page)
  }, [])

  const handleTabPress = useCallback((index: 0 | 1) => {
    pagerRef.current?.setPage(index)
  }, [])

  // Un feed n'est actif que si : l'onglet Feed est focus, c'est la page
  // sélectionnée, ET aucun swipe n'est en cours.
  const forYouActive = isTabFocused && activeTab === 0 && !isSwiping
  const followingActive = isTabFocused && activeTab === 1 && !isSwiping

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPagerView
        ref={pagerRef}
        style={StyleSheet.absoluteFill}
        initialPage={0}
        overdrag={false}
        onPageScroll={handlePageScroll}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        onPageSelected={handlePageSelected}
      >
        <View key="forYou" style={StyleSheet.absoluteFill}>
          <FeedScreen feedType="forYou" isActive={forYouActive} />
        </View>
        <View key="following" style={StyleSheet.absoluteFill}>
          <FeedScreen feedType="following" isActive={followingActive} />
        </View>
      </AnimatedPagerView>
      <FeedTabsHeader scrollPosition={scrollPosition} onTabPress={handleTabPress} />
    </View>
  )
}
