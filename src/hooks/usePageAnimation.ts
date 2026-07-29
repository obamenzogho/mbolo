import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useAppliedAccessibility } from '@/features/settings/appliedStore';

export const usePageAnimation = (type = 'fadeSlide') => {
  const reduceMotion = useAppliedAccessibility((s) => s.reduceMotion);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateX = useSharedValue(reduceMotion ? 0 : 8);
  const scale = useSharedValue(reduceMotion ? 1 : 0.98);

  useEffect(() => {
    // Réduction des animations (accessibilité) : on pose l'état final sans transition.
    if (reduceMotion) {
      opacity.value = 1;
      translateX.value = 0;
      scale.value = 1;
      return;
    }

    opacity.value = withTiming(1, {
      duration: 300,
    });

    translateX.value = withSpring(0, {
      damping: 30,
      stiffness: 150,
    });

    scale.value = withSpring(1, {
      damping: 30,
      stiffness: 150,
    });
  }, [reduceMotion]);

  const animations = {
    fadeSlide: useAnimatedStyle(() => ({
      opacity: opacity.value,
    })),
    fade: useAnimatedStyle(() => ({
      opacity: opacity.value,
    })),
    scale: useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    })),
    slideRight: useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    })),
    /** Aucune animation d'entrée : la transition est déjà assurée par le native-stack. */
    stack: useAnimatedStyle(() => ({})),
  };

  return animations[type as keyof typeof animations] || animations.fadeSlide;
};