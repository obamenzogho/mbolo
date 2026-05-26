import { useEffect, useRef, useCallback } from 'react'
import { View, useColorScheme, Image, Text } from 'react-native'

export default function SplashScreen({ onReady }: { onReady?: () => void }) {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const calledRef = useRef(false)

  const triggerReady = useCallback(() => {
    if (!calledRef.current) {
      calledRef.current = true
      onReady?.()
    }
  }, [onReady])

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerReady()
    }, 1500)

    return () => {
      clearTimeout(timer)
    }
  }, [triggerReady])

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#0D1117' : '#F7FFFB',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 120,
      }}
    >
      <Image
        source={require('../../assets/splash-icon.png')}
        style={{ width: 220, height: 220, resizeMode: 'contain' }}
      />

      <View style={{ position: 'absolute', bottom: 60, alignItems: 'center' }}>
        <Text style={{ color: isDark ? '#A8A8A8' : '#5C5C5C', fontSize: 11, fontWeight: '400', letterSpacing: 0.3 }}>
          Par
        </Text>
        <Text style={{ color: '#3797F0', fontSize: 13, fontWeight: '600', marginTop: 1, letterSpacing: 0.2 }}>
          Groupe NZOGHO
        </Text>
      </View>
    </View>
  )
}