import { useEffect, useCallback } from 'react'
import {
  View, TouchableOpacity, Dimensions, Modal, StyleSheet,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'

const SCREEN_HEIGHT = Dimensions.get('window').height

type BottomSheetProps = {
  visible: boolean
  onClose: () => void
  height?: number | 'auto'
  showDragHandle?: boolean
  enableSwipeToDismiss?: boolean
  children: React.ReactNode
  containerStyle?: Record<string, unknown>
}

export default function BottomSheet({
  visible,
  onClose,
  height = SCREEN_HEIGHT * 0.85,
  showDragHandle = true,
  enableSwipeToDismiss = true,
  children,
  containerStyle,
}: BottomSheetProps) {
  const isAuto = height === 'auto'
  const closedOffset = isAuto ? 300 : (height as number)
  const translateY = useSharedValue(closedOffset)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      translateY.value = closedOffset
      backdropOpacity.value = 0
      backdropOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
    }
  }, [visible])

  const animateAndClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) })
    translateY.value = withTiming(closedOffset, { duration: 250, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onClose)()
    })
  }, [onClose, closedOffset])

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) translateY.value = event.translationY
    })
    .onEnd((event) => {
      if (event.translationY > 150 || event.velocityY > 500) {
        runOnJS(animateAndClose)()
      } else {
        translateY.value = withSpring(0, { damping: 40, stiffness: 300 })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const gesture = enableSwipeToDismiss ? panGesture : Gesture.Pan().enabled(false)

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateAndClose}>
      <View style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, backdropStyle]}
        />
        <TouchableOpacity style={styles.backdropPress} activeOpacity={1} onPress={animateAndClose} />
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              styles.sheet,
              isAuto ? styles.sheetAuto : { height: height as number },
              sheetStyle,
              containerStyle,
            ]}
          >
            {showDragHandle && (
              <View style={styles.dragHandleContainer}>
                <View style={styles.dragHandle} />
              </View>
            )}
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetAuto: {
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
  },
})
