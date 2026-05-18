import { useCallback } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { colors } from '../lib/theme'

const DELETE_THRESHOLD = 120

interface DraggableElementProps {
  children: React.ReactNode
  onDelete?: () => void
  onEdit?: () => void
  initialPosition?: { x: number; y: number }
  onPositionChange?: (x: number, y: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

const DraggableElement = ({
  children,
  onDelete,
  onEdit,
  initialPosition,
  onPositionChange,
  onDragStart,
  onDragEnd,
}: DraggableElementProps) => {
  const translateX = useSharedValue(initialPosition?.x ?? 0)
  const translateY = useSharedValue(initialPosition?.y ?? 0)
  const scale = useSharedValue(1)
  const rotation = useSharedValue(0)
  const savedScale = useSharedValue(1)
  const savedRotation = useSharedValue(0)
  const contextX = useSharedValue(0)
  const contextY = useSharedValue(0)

  const deleteZoneOpacity = useSharedValue(0)

  const triggerDelete = useCallback(() => {
    onDelete?.()
  }, [onDelete])

  const triggerEdit = useCallback(() => {
    onEdit?.()
  }, [onEdit])

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value
      contextY.value = translateY.value
      deleteZoneOpacity.value = withTiming(1, { duration: 200 })
      runOnJS(onDragStart ?? (() => {}))()
    })
    .onUpdate((e) => {
      translateX.value = contextX.value + e.translationX
      translateY.value = contextY.value + e.translationY
      if (translateY.value > DELETE_THRESHOLD) {
        scale.value = withSpring(0.5, { damping: 15 })
      } else {
        scale.value = withSpring(1, { damping: 15 })
      }
    })
    .onEnd(() => {
      deleteZoneOpacity.value = withTiming(0, { duration: 200 })
      runOnJS(onDragEnd ?? (() => {}))()
      if (translateY.value > DELETE_THRESHOLD) {
        runOnJS(triggerDelete)()
      } else {
        runOnJS(triggerEdit)()
        onPositionChange?.(translateX.value, translateY.value)
      }
      scale.value = withSpring(1, { damping: 15 })
    })

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (scale.value < 0.3) {
        scale.value = withSpring(0.3)
        savedScale.value = 0.3
      }
      if (scale.value > 4) {
        scale.value = withSpring(4)
        savedScale.value = 4
      }
    })

  const rotationGesture = Gesture.Rotation()
    .onUpdate((e) => {
      rotation.value = savedRotation.value + e.rotation
    })
    .onEnd(() => {
      savedRotation.value = rotation.value
    })

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(triggerEdit)()
    })

  const composed = Gesture.Simultaneous(
    panGesture,
    Gesture.Simultaneous(pinchGesture, rotationGesture)
  )

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }))

  return (
    <GestureDetector gesture={Gesture.Race(doubleTapGesture, composed)}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  )
}

export const DeleteZone = ({ isVisible }: { isVisible: boolean }) => {
  const opacity = useSharedValue(0)

  if (isVisible) {
    opacity.value = withTiming(1, { duration: 200 })
  } else {
    opacity.value = withTiming(0, { duration: 200 })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[styles.deleteZone, animatedStyle]}>
      <Text style={styles.deleteIcon}>🗑️</Text>
      <Text style={styles.deleteText}>Supprimer</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  deleteZone: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  deleteIcon: {
    fontSize: 32,
    textAlign: 'center',
  },
  deleteText: {
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})

export default DraggableElement