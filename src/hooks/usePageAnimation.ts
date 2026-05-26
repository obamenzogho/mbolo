import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

export const usePageAnimation = (type = 'fadeSlide') => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(8);
  const scale = useSharedValue(0.98);

  useEffect(() => {
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
  }, []);

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
  };

  return animations[type as keyof typeof animations] || animations.fadeSlide;
};