import { useEffect, useRef, useState, useCallback } from 'react'
import { AppState, InteractionManager } from 'react-native'
import { useRouter } from 'expo-router'
import { useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated'
import { useStartupStore } from '../store/startupStore'
import { runStartup } from '../services/startupManager'
import { markStartupStart } from '../services/startupAnalytics'

const SPLASH_MIN_MS = 1800
const TRANSITION_DURATION_MS = 600
const LOGO_FADE_DURATION = 400

export function useStartup() {
  const phase = useStartupStore((s) => s.phase)
  const setPhase = useStartupStore((s) => s.setPhase)
  const setWarmStart = useStartupStore((s) => s.setWarmStart)
  const cachedVideos = useStartupStore((s) => s.cachedVideos)
  const error = useStartupStore((s) => s.error)
  const user = useStartupStore((s) => s.user)
  const router = useRouter()

  const logoOpacity = useSharedValue(1)
  const logoScale = useSharedValue(1)
  const feedOpacity = useSharedValue(0)
  const feedScale = useSharedValue(0.96)

  const [ready, setReady] = useState(false)
  const startupDoneRef = useRef(false)
  const launchTimeRef = useRef(Date.now())

  const startTransition = useCallback(() => {
    'worklet'
    logoOpacity.value = withTiming(0, { duration: LOGO_FADE_DURATION, easing: Easing.out(Easing.cubic) })
    logoScale.value = withTiming(0.8, { duration: LOGO_FADE_DURATION, easing: Easing.out(Easing.cubic) })
    feedOpacity.value = withDelay(
      LOGO_FADE_DURATION,
      withTiming(1, { duration: TRANSITION_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    )
    feedScale.value = withDelay(
      LOGO_FADE_DURATION,
      withTiming(1, { duration: TRANSITION_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    )
  }, [logoOpacity, logoScale, feedOpacity, feedScale])

  useEffect(() => {
    markStartupStart()
    setPhase('init')

    const elapsed = Date.now() - launchTimeRef.current
    const splashRemaining = Math.max(0, SPLASH_MIN_MS - elapsed)

    const timer = setTimeout(async () => {
      const result = await runStartup()
      startupDoneRef.current = true

      if (!result.isAuthenticated) {
        startTransition()
        setTimeout(() => setReady(true), LOGO_FADE_DURATION + TRANSITION_DURATION_MS + 100)
        return
      }

      startTransition()
      setTimeout(() => setReady(true), LOGO_FADE_DURATION + TRANSITION_DURATION_MS + 100)
    }, splashRemaining)

    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && startupDoneRef.current) {
        setWarmStart(true)
      }
    })
    return () => sub.remove()
  }, [setWarmStart])

  const isAuthenticated = !!user
  const shouldRedirectAuth = phase === 'ready' && !isAuthenticated

  useEffect(() => {
    if (shouldRedirectAuth) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/(auth)/login')
      })
    }
  }, [shouldRedirectAuth, router])

  return {
    logoOpacity,
    logoScale,
    feedOpacity,
    feedScale,
  }
}
