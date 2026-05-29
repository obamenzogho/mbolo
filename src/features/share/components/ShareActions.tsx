import { memo, useRef, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Platform, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

interface ShareActionItem {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  color?: string
}

interface ShareActionsProps {
  actions: ShareActionItem[]
}

function ShareActionsComponent({ actions }: ShareActionsProps) {
  const { width: screenWidth } = useWindowDimensions()
  const [scrollOffset, setScrollOffset] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const containerRef = useRef<View>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const indicatorWidth = Math.max(12, containerWidth * Math.min(1, containerWidth / (contentWidth || 1)) * 0.5)
  const maxTranslate = Math.max(0, containerWidth - indicatorWidth)
  const scrollRange = Math.max(1, contentWidth - containerWidth)
  const indicatorOffset = (scrollOffset / scrollRange) * maxTranslate

  const handleScroll = useCallback((e: any) => {
    setScrollOffset(e.nativeEvent.contentOffset.x)
  }, [])

  const handleContentSizeChange = useCallback((w: number) => {
    setContentWidth(w)
  }, [])

  const handleContainerLayout = useCallback(() => {
    containerRef.current?.measureInWindow((_x, _y, w) => {
      setContainerWidth(w - 32)
    })
  }, [])

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Partager sur les réseaux
      </Text>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
        >
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={action.onPress}
              style={{ alignItems: 'center', gap: 6 }}
            >
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: action.color ? `${action.color}20` : '#1a1a2e',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name={action.icon} size={24} color={action.color || colors.white} />
              </View>
              <Text style={{ color: '#CCC', fontSize: 11, textAlign: 'center', width: 60 }}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View
          ref={containerRef}
          onLayout={handleContainerLayout}
          style={{ marginTop: 8, height: 2 }}
        >
          <View style={{
            width: indicatorWidth,
            height: 2,
            borderRadius: 1,
            backgroundColor: '#00C853',
            opacity: 0.4,
            transform: [{ translateX: indicatorOffset }],
          }} />
        </View>
      </View>
    </View>
  )
}

export const ShareActions = memo(ShareActionsComponent)
