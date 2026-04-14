/* FeedTabsScreen — swipe horizontal entre "[Ville] / Pour toi / Suivi".
   Rôle : PagerView pré-monte les 3 FeedScreen pour swipe instantané.
   Header animé synchronisé via scrollPosition (Animated.Value interpolé).
   « Pour toi » (index 1) est l'onglet par défaut à l'ouverture.
   isSwiping : pendant un swipe, AUCUN feed n'est actif → tous les pools se
   coupent (setActive(false)). Le feed cible ne (re)joue qu'une fois le geste
   terminé, ce qui empêche deux onglets de jouer simultanément. */

import { useRef, useState, useCallback } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import PagerView from 'react-native-pager-view'
import FeedScreen from './FeedScreen'
import LocalExploreScreen from './LocalExploreScreen'
import FeedTabsHeader from './components/FeedTabsHeader'
import { FEED_DEBUG } from './store/feedStore'
import { useUserLocation } from '../location/useUserLocation'

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView)

const DEFAULT_TAB = 1 // "Pour toi"

interface FeedTabsScreenProps {
  isTabFocused?: boolean
}

export default function FeedTabsScreen({ isTabFocused = true }: FeedTabsScreenProps) {
  const scrollPosition = useRef(new Animated.Value(DEFAULT_TAB)).current
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(DEFAULT_TAB)
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

  const handlePageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    const page = e.nativeEvent.position
    setActiveTab(page as 0 | 1 | 2)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] TABS: page selected →', page)
  }, [])

  const handleTabPress = useCallback((index: 0 | 1 | 2) => {
    pagerRef.current?.setPage(index)
  }, [])

  // Un feed n'est actif que si : l'onglet Feed est focus, c'est la page
  // sélectionnée, ET aucun swipe n'est en cours. (L'onglet local est une grille
  // de cards : aucune lecture tant qu'on n'ouvre pas une vidéo en plein écran.)
  const stable = isTabFocused && !isSwiping
  const forYouActive = stable && activeTab === 1
  const followingActive = stable && activeTab === 2

  const cityLabel = place?.city ?? 'À proximité'
  // « Position précise obtenue » = GPS réel. Tant qu'on n'a qu'une position
  // approximative (réseau/IP) ou rien, un tap sur l'onglet relance la demande
  // GPS pour afficher la VRAIE ville.
  const hasPreciseLocation = place != null && status === 'granted'

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPagerView
        ref={pagerRef}
        style={StyleSheet.absoluteFill}
        initialPage={DEFAULT_TAB}
        overdrag={false}
        onPageScroll={handlePageScroll}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        onPageSelected={handlePageSelected}
      >
        <View key="local" style={StyleSheet.absoluteFill}>
          <LocalExploreScreen place={place} cityLabel={cityLabel} />
        </View>
        <View key="forYou" style={StyleSheet.absoluteFill}>
          <FeedScreen feedType="forYou" isActive={forYouActive} />
        </View>
        <View key="following" style={StyleSheet.absoluteFill}>
          <FeedScreen feedType="following" isActive={followingActive} />
        </View>
      </AnimatedPagerView>
      <FeedTabsHeader
        scrollPosition={scrollPosition}
        onTabPress={handleTabPress}
        cityLabel={cityLabel}
        locationGranted={hasPreciseLocation}
        onRequestLocation={request}
      />
    </View>
  )
}
