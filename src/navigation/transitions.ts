import { Platform } from 'react-native'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

/**
 * iOS : le native-stack (react-native-screens) gère nativement le swipe-back.
 * Android / Web : geste non fiable ou inexistant -> fallback JS via SwipeBackView.
 */
export const HAS_NATIVE_SWIPE_BACK = Platform.OS === 'ios'

const gesture: NativeStackNavigationOptions = Platform.select<NativeStackNavigationOptions>({
  ios: {
    gestureEnabled: true,
    // Plein écran, le geste natif se déclenche n'importe où sur l'écran —
    // y compris pendant un scroll vertical avec une légère dérive
    // horizontale. Limité au bord gauche, il redevient le geste natif iOS
    // classique, sans conflit avec le scroll.
    fullScreenGestureEnabled: false,
    animationMatchesGesture: true,
  },
  android: { gestureEnabled: true },
  default: {},
})!

export const slideRight: NativeStackNavigationOptions = {
  ...gesture,
  animation: 'slide_from_right',
  animationTypeForReplace: 'push',
}

export const slideUp: NativeStackNavigationOptions = {
  ...gesture,
  animation: 'slide_from_bottom',
  gestureDirection: 'vertical',
  animationTypeForReplace: 'push',
}

export const slideUpFast: NativeStackNavigationOptions = {
  ...slideUp,
  animationDuration: 300,
}

export const fadeFromBottom: NativeStackNavigationOptions = {
  ...gesture,
  animation: 'fade_from_bottom',
  gestureDirection: 'vertical',
  animationTypeForReplace: 'push',
}

export const none: NativeStackNavigationOptions = { animation: 'none' }

/** Geste limité au bord gauche (utile quand la page contient un pager/carousel horizontal). */
export const slideRightEdgeOnly: NativeStackNavigationOptions = {
  ...slideRight,
  fullScreenGestureEnabled: false,
  gestureResponseDistance: { start: 40 },
}
