import '../global.css'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { onAuthStateChanged } from 'firebase/auth'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Notifications from 'expo-notifications'
import { auth } from '../src/lib/firebase'
import SplashScreen from '../src/components/SplashScreen'
import ErrorBoundary from '../src/components/ErrorBoundary'
import { I18nProvider } from '../src/i18n/index'
import notificationService from '../src/services/notificationService'

const handleNotificationNavigation = (type: string, data: Record<string, any>) => {
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
  const splashPromise = useRef<Promise<void>>()
  const router = useRouter()
  const responseListenerRef = useRef<any>(null)

  useEffect(() => {
    splashPromise.current = new Promise((resolve) => {
      setTimeout(resolve, 2000)
    })
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!authReady) return
    splashPromise.current?.then(() => setSplashDone(true))
  }, [authReady])

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

    responseListenerRef.current = notificationService.addNotificationResponseReceived((response) => {
      const { type, ...rest } = response.notification.request.content.data || {}
      handleNotificationNavigation(type, rest)
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
    <I18nProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{ headerShown: false }}
            screenListeners={{
              state: (e) => {
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
        </GestureHandlerRootView>
      </ErrorBoundary>
    </I18nProvider>
  )
}