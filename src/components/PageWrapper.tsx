import React from 'react'
import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'
import { usePageAnimation } from '@/hooks/usePageAnimation'
import SwipeBackView from '@/components/SwipeBackView'
import { HAS_NATIVE_SWIPE_BACK } from '@/navigation/transitions'
import { colors } from '@/lib/theme'

interface PageWrapperProps {
  children: React.ReactNode
  type?: 'fadeSlide' | 'fade' | 'scale' | 'slideRight' | 'stack'
  style?: object
  /** Active le retour par glissement (no-op sur iOS : le native-stack le fait déjà). */
  swipeBack?: boolean
  /** Limite le geste au bord gauche. Indispensable si la page contient un scroll/pager horizontal. */
  swipeBackEdgeOnly?: boolean
  /** Route de repli quand la stack est vide. */
  backTo?: string
  /** Désactive temporairement le geste (enregistrement caméra, formulaire modifié, etc.). */
  swipeBackEnabled?: boolean
}

/**
 * Conteneur d'animation d'entrée de page + retour par glissement optionnel.
 * Le fond `colors.background` couvre toute la surface pour éviter les bordures
 * claires pendant les transitions.
 */
const PageWrapper: React.FC<PageWrapperProps> = ({
  children,
  type = 'fadeSlide',
  style,
  swipeBack = false,
  swipeBackEdgeOnly = false,
  swipeBackEnabled = true,
  backTo,
}) => {
  const animatedStyle = usePageAnimation(type)

  const content = (
    <Animated.View style={[styles.container, animatedStyle, style]}>{children}</Animated.View>
  )

  // Sur iOS, le geste natif gère déjà le pop : ne pas empiler deux gestes.
  if (!swipeBack || HAS_NATIVE_SWIPE_BACK) return content

  return (
    <SwipeBackView
      enabled={swipeBackEnabled}
      edgeOnly={swipeBackEdgeOnly}
      backTo={backTo}
    >
      {content}
    </SwipeBackView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
})

export default PageWrapper
