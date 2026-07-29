import React from 'react'
import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'
import { usePageAnimation } from '@/hooks/usePageAnimation'
import { useIsStackEntry } from '@/hooks/useIsStackEntry'
import SwipeBackView from '@/components/SwipeBackView'
import { HAS_NATIVE_SWIPE_BACK } from '@/navigation/transitions'
import { colors } from '@/lib/theme'

interface PageWrapperProps {
  children: React.ReactNode
  type?: 'fadeSlide' | 'fade' | 'scale' | 'slideRight' | 'stack'
  style?: object
  /** Active le retour par glissement. */
  swipeBack?: boolean
  /** Limite le geste au bord gauche. Indispensable si la page a un scroll/pager horizontal. */
  swipeBackEdgeOnly?: boolean
  /** Route de repli quand la stack est vide. */
  backTo?: string
  /** Désactive temporairement le geste (enregistrement caméra, formulaire modifié...). */
  swipeBackEnabled?: boolean
}

/**
 * Conteneur d'animation d'entrée de page + retour par glissement.
 *
 * `type="stack"` s'adapte à la position de l'écran :
 * - poussé sur la Stack -> aucune animation JS (le natif la fait)
 * - premier écran de la Stack (atteint par un jump d'onglet) -> slide JS,
 *   car le Tabs navigator n'anime rien et le geste natif est inerte à index 0.
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
  const isStackEntry = useIsStackEntry()
  const resolvedType = type === 'stack' && isStackEntry ? 'stackEntry' : type
  const animatedStyle = usePageAnimation(resolvedType)

  const content = (
    <Animated.View style={[styles.container, animatedStyle, style]}>{children}</Animated.View>
  )

  // Le geste JS est nécessaire quand le natif ne peut pas popper :
  // - Android / Web : pas de geste natif fiable
  // - iOS mais premier écran de la Stack : rien à popper
  const needsJsGesture = swipeBack && (!HAS_NATIVE_SWIPE_BACK || isStackEntry)
  if (!needsJsGesture) return content

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
