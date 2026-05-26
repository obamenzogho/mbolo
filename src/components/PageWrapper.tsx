import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePageAnimation } from '../hooks/usePageAnimation';

interface PageWrapperProps {
  children: React.ReactNode;
  type?: 'fadeSlide' | 'fade' | 'scale' | 'slideRight';
  style?: object;
}

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
  },
});

export default PageWrapper;