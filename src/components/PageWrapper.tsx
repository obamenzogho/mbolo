import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePageAnimation } from '../hooks/usePageAnimation';
import { colors } from '../lib/theme';

interface PageWrapperProps {
  children: React.ReactNode;
  type?: 'fadeSlide' | 'fade' | 'scale' | 'slideRight';
  style?: object;
}

/**
 * Conteneur d'animation d'entrée de page.
 *
 * Le fond `colors.background` couvre toute la surface : pendant les
 * transitions (slide/scale) le contenu peut être translaté ou réduit, et sans
 * ce fond opaque on verrait apparaître le fond par défaut (blanc) du navigateur
 * sous forme de bordures claires. `overflow: 'hidden'` empêche en plus le
 * contenu enfant de déborder pendant l'animation.
 */
const PageWrapper: React.FC<PageWrapperProps> = ({
  children,
  type = 'fadeSlide',
  style,
}) => {
  const animatedStyle = usePageAnimation(type);

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default PageWrapper;
