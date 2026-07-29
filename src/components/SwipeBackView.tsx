import React from 'react'
import { StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useSwipeBack, type UseSwipeBackOptions } from '@/hooks/useSwipeBack'
import { colors } from '@/lib/theme'

interface SwipeBackViewProps extends UseSwipeBackOptions {
  children: React.ReactNode
  style?: object
}

/**
 * Retour par glissement horizontal, indépendant du navigateur.
 * Utilisé sur Android, Web, et sur iOS pour le premier écran d'une Stack
 * (où le geste natif n'a rien à popper).
 */
const SwipeBackView: React.FC<SwipeBackViewProps> = ({ children, style, ...options }) => {
  const { gesture, pageStyle, edgeShadowStyle, scrimStyle, underlayStyle } = useSwipeBack(options)

  return (
    <View style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.underlay, underlayStyle]}>
        <Animated.View style={[styles.scrim, scrimStyle]} />
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.page, pageStyle, style]}>
          <Animated.View pointerEvents="none" style={[styles.edgeShadow, edgeShadowStyle]} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  underlay: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  page: { flex: 1, backgroundColor: colors.background },
  edgeShadow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -14,
    width: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
})

export default SwipeBackView
