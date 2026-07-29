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
 * Utilisé sur Android et Web, où le geste natif de native-stack est
 * respectivement peu fiable et inexistant.
 */
const SwipeBackView: React.FC<SwipeBackViewProps> = ({ children, style, ...options }) => {
  const { gesture, pageStyle, scrimStyle, underlayStyle } = useSwipeBack(options)

  return (
    <View style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.underlay, underlayStyle]}>
        <Animated.View style={[styles.scrim, scrimStyle]} />
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.page, pageStyle, style]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  underlay: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  page: {
    flex: 1,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowRadius: 12,
    elevation: 12,
  },
})

export default SwipeBackView
