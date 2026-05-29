import { View, Text, Image, Dimensions, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useStartupStore } from '../store/startupStore'

const { width, height } = Dimensions.get('window')

interface StartupScreenProps {
  logoOpacity: SharedValue<number>
  logoScale: SharedValue<number>
  feedOpacity: SharedValue<number>
  feedScale: SharedValue<number>
  children: React.ReactNode
}

export default function StartupScreen({
  logoOpacity,
  logoScale,
  feedOpacity,
  feedScale,
  children,
}: StartupScreenProps) {
  const insets = useSafeAreaInsets()
  const phase = useStartupStore((s) => s.phase)
  const error = useStartupStore((s) => s.error)

  const showSkeleton = phase === 'preloading' || phase === 'hydrating'

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }))

  const feedAnimatedStyle = useAnimatedStyle(() => ({
    opacity: feedOpacity.value,
    transform: [{ scale: feedScale.value }],
  }))

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, feedAnimatedStyle]}>
        {children}
      </Animated.View>

      {showSkeleton && (
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: '#0D1117',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: insets.top,
        }}>
          <View style={{ gap: 16, paddingHorizontal: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: width - 32,
                  height: height * 0.75,
                  borderRadius: 12,
                  backgroundColor: '#1a1a2e',
                  overflow: 'hidden',
                }}
              >
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: '60%',
                  height: '100%',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }} />
              </View>
            ))}
          </View>
        </View>
      )}

      <Animated.View
        style={[
          {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: '#0D1117',
            justifyContent: 'center',
            alignItems: 'center',
          },
          logoAnimatedStyle,
        ]}
        pointerEvents="none"
      >
        <View style={{ alignItems: 'center', marginTop: -80 }}>
          <Image
            source={require('../../../../assets/icon.png')}
            style={{ width: 160, height: 160 }}
            resizeMode="contain"
          />
          <Text style={{
            color: '#00C853',
            fontSize: 32,
            fontWeight: '700',
            letterSpacing: 1,
            marginTop: 12,
          }}>
            Mbolo
          </Text>
        </View>
        <View style={{ position: 'absolute', bottom: 80, alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 11, fontWeight: '400', letterSpacing: 0.3 }}>
            Du
          </Text>
          <Text style={{ color: '#3797F0', fontSize: 13, fontWeight: '600', marginTop: 2, letterSpacing: 0.2 }}>
            Groupe NZOGHO
          </Text>
          {error && (
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <Ionicons name="alert-circle-outline" size={18} color="#FF4444" />
              <Text style={{ color: '#FF4444', fontSize: 12, marginTop: 4 }}>{error.message}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}
