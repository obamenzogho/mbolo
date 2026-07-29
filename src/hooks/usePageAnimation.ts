import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useAppliedAccessibility } from '@/features/settings/appliedStore';

export const usePageAnimation = (type = 'fadeSlide') => {
  const reduceMotion = useAppliedAccessibility((s) => s.reduceMotion);
  const { width } = useWindowDimensions();

  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateX = useSharedValue(reduceMotion ? 0 : 8);
  const scale = useSharedValue(reduceMotion ? 1 : 0.98);
  // Entrée depuis le bord droit : compense l'absence d'animation du Tabs navigator.
  const entryX = useSharedValue(reduceMotion ? 0 : width);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateX.value = 0;
      scale.value = 1;
      entryX.value = 0;
      return;
    }

    opacity.value = withTiming(1, { duration: 300 });
    translateX.value = withSpring(0, { damping: 30, stiffness: 150 });
    scale.value = withSpring(1, { damping: 30, stiffness: 150 });
    entryX.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion]);

  const animations = {
    fadeSlide: useAnimatedStyle(() => ({ opacity: opacity.value })),
    fade: useAnimatedStyle(() => ({ opacity: opacity.value })),
    scale: useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    })),
    slideRight: useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    })),
    /** Écran poussé sur la Stack : la transition est déjà native. */
    stack: useAnimatedStyle(() => ({})),
    /** Écran d'entrée de la Stack (atteint par un jump d'onglet) : slide JS. */
    stackEntry: useAnimatedStyle(() => ({
      transform: [{ translateX: entryX.value }],
    })),
  };

  return animations[type as keyof typeof animations] || animations.fadeSlide;
};
