import { Easing } from 'react-native-reanimated';

export const slideUpTransition = {
  gestureDirection: 'vertical' as const,
  transitionSpec: {
    open: {
      animation: 'timing' as const,
      config: {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      },
    },
    close: {
      animation: 'timing' as const,
      config: {
        duration: 300,
        easing: Easing.in(Easing.cubic),
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }: any) => ({
    cardStyle: {
      transform: [{
        translateY: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [layouts.screen.height, 0],
        }),
      }],
    },
  }),
};

export const slideRightTransition = {
  gestureDirection: 'horizontal' as const,
  transitionSpec: {
    open: {
      animation: 'spring' as const,
      config: {
        stiffness: 1000,
        damping: 100,
        mass: 3,
        overshootClamping: true,
      },
    },
    close: {
      animation: 'spring' as const,
      config: {
        stiffness: 1000,
        damping: 100,
        mass: 3,
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }: any) => ({
    cardStyle: {
      transform: [{
        translateX: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [layouts.screen.width, 0],
        }),
      }],
    },
  }),
};

export const fadeTransition = {
  transitionSpec: {
    open: {
      animation: 'timing' as const,
      config: { duration: 400 },
    },
    close: {
      animation: 'timing' as const,
      config: { duration: 300 },
    },
  },
  cardStyleInterpolator: ({ current }: any) => ({
    cardStyle: {
      opacity: current.progress,
    },
  }),
};

export const scaleTransition = {
  transitionSpec: {
    open: {
      animation: 'spring' as const,
      config: {
        stiffness: 300,
        damping: 30,
      },
    },
    close: {
      animation: 'timing' as const,
      config: { duration: 250 },
    },
  },
  cardStyleInterpolator: ({ current }: any) => ({
    cardStyle: {
      opacity: current.progress,
      transform: [{
        scale: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      }],
    },
  }),
};

export const slideBottomTransition = {
  gestureDirection: 'vertical' as const,
  transitionSpec: {
    open: {
      animation: 'spring' as const,
      config: {
        stiffness: 500,
        damping: 60,
        mass: 1,
      },
    },
    close: {
      animation: 'timing' as const,
      config: { duration: 280 },
    },
  },
  cardStyleInterpolator: ({ current, layouts }: any) => ({
    cardStyle: {
      transform: [{
        translateY: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [layouts.screen.height, 0],
        }),
      }],
    },
  }),
};