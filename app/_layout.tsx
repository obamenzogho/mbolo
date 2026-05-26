import '../global.css'

import { NavigationHistoryProvider } from '../src/providers/NavigationHistoryProvider'
import { initSentry, setSentryUser, setSentryRoute } from '../src/lib/sentry'
initSentry()

const origWarn = console.warn
console.warn = (...args: any[]) => {
  const msg = args.join(' ')
  if (msg.includes('THREE.Clock') || msg.includes('Reading from `value`')) return
  origWarn(...args)
}
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Stack, useRouter, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { onAuthStateChanged } from 'firebase/auth'
import SafeGestureHandlerRootView from '../src/components/SafeGestureHandlerRootView'
import * as Notifications from 'expo-notifications'
import { auth } from '../src/lib/firebase'
import SplashScreen from '../src/components/SplashScreen'
import ErrorBoundary from '../src/components/ErrorBoundary'
import { I18nProvider } from '../src/i18n/index'
import notificationService from '../src/services/notificationService'
import { usePresence } from '../src/hooks/usePresence'

const handleNotificationNavigation = (router: ReturnType<typeof useRouter>, type: string, data: Record<string, any>) => {
  switch (type) {
    case 'follow':
    case 'follow_request':
      if (data.userId) router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: data.userId } })
      break
    case 'like':
    case 'comment':
    case 'reply':
    case 'mention':
    case 'trending':
      if (data.postId) router.push({ pathname: '/(tabs)/feed', params: { highlightPost: data.postId } })
      break
    case 'story_view':
      router.push('/(tabs)/stories')
      break
    case 'milestone':
      router.push('/(tabs)/profile')
      break
    default:
      router.push('/(tabs)/notifications')
  }
}

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const [user, setUser] = useState<any>(null)
  const splashPromise = useRef<Promise<void> | null>(null)
  const router = useRouter()
  const responseListenerRef = useRef<any>(null)
  const pathname = usePathname()
  usePresence()

  useEffect(() => {
    splashPromise.current = new Promise((resolve) => {
      setTimeout(resolve, 2000)
    })
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: any) => {
      setUser(u)
      setSentryUser(u)
      setAuthReady(true)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!authReady) return
    splashPromise.current?.then(() => setSplashDone(true))
  }, [authReady])

  useEffect(() => {
    setSentryRoute(pathname)
  }, [pathname])

  useEffect(() => {
    if (!user) return

    notificationService.requestPermissions().then((token) => {
      if (token) {
        notificationService.saveToken(user.uid, token)
      }
    }).catch(console.error)

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('mbolo', {
        name: 'Mbolo',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00A86B',
      })
    }

    responseListenerRef.current = notificationService.addNotificationResponseReceived((response: any) => {
      const { type, ...rest } = response.notification.request.content.data || {}
      handleNotificationNavigation(router, String(type || ''), rest)
    })

    return () => {
      if (responseListenerRef.current) {
        responseListenerRef.current.remove()
      }
    }
  }, [user, authReady])

  if (!splashDone) {
    return <SplashScreen />
  }

  return (
    <SafeGestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <ErrorBoundary>
          <StatusBar style="light" />
          <NavigationHistoryProvider>
            <Stack
              screenOptions={{ headerShown: false }}
              screenListeners={{
                state: (e: any) => {
                  const state = e.data.state
                  if (!state) return
                  const routeName = state.routes[state.index]?.name
                  const isAuthRoute = routeName === '(auth)' || routeName === '(auth)/login' || routeName === '(auth)/register'
                  if (!isAuthRoute && !user) {
                    router.replace('/(auth)/login')
                  } else if (isAuthRoute && user) {
                    router.replace('/(tabs)/feed')
                  }
                },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="post" options={{ headerShown: false, presentation: 'modal' }} />
            </Stack>
          </NavigationHistoryProvider>
        </ErrorBoundary>
      </I18nProvider>
    </SafeGestureHandlerRootView>
  )
}
