import { Platform } from 'react-native'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

const gestureEnabled = Platform.select<Pick<NativeStackNavigationOptions, 'gestureEnabled'>>({
  ios: { gestureEnabled: true },
  android: { gestureEnabled: true },
  default: {},
})

export const slideRight: NativeStackNavigationOptions = {
  ...gestureEnabled,
  animation: 'slide_from_right',
  animationMatchesGesture: true,
  fullScreenGestureEnabled: true,
  animationTypeForReplace: 'push',
}

export const slideUp: NativeStackNavigationOptions = {
  ...gestureEnabled,
  animation: 'slide_from_bottom',
  gestureDirection: 'vertical',
  animationMatchesGesture: true,
  fullScreenGestureEnabled: true,
  animationTypeForReplace: 'push',
}

export const fadeFromBottom: NativeStackNavigationOptions = {
  ...gestureEnabled,
  animation: 'fade_from_bottom',
  gestureDirection: 'vertical',
  animationMatchesGesture: true,
  fullScreenGestureEnabled: true,
  animationTypeForReplace: 'push',
}

export const none: NativeStackNavigationOptions = {
  animation: 'none',
}

export const slideUpFast: NativeStackNavigationOptions = {
  ...slideUp,
  animationDuration: 300,
}

export const slideRightWithGesture: NativeStackNavigationOptions = {
  ...slideRight,
  gestureResponseDistance: { start: 20 },
}
