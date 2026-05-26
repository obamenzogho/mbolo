import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'

const DEV = __DEV__

export function PerformanceMonitor({ visible }: { visible?: boolean }) {
  const [fps, setFps] = useState(0)
  const [jsRenderCount, setJsRenderCount] = useState(0)
  const frameTimesRef = useRef<number[]>([])
  const rafRef = useRef<number>(0)
  const renderCountRef = useRef(0)
  const [show, setShow] = useState(false)

  renderCountRef.current += 1

  useEffect(() => {
    if (!DEV || visible === false) return
    setShow(true)
    let lastFrame = performance.now()

    const tick = () => {
      const now = performance.now()
      const delta = now - lastFrame
      lastFrame = now

      frameTimesRef.current.push(delta)
      if (frameTimesRef.current.length > 60) frameTimesRef.current.shift()

      const avg = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      setFps(Math.round(1000 / avg))
      setJsRenderCount(renderCountRef.current)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible])

  if (!DEV || !show) return null

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>{fps} FPS</Text>
      <Text style={styles.text}>Renders: {jsRenderCount}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 8,
    zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  text: {
    color: '#0f0',
    fontSize: 10,
    fontFamily: 'monospace',
  },
})
