import '../src/lib/crash-debug'
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
import { useEffect, useRef } from 'react'
import { InteractionManager, Platform } from 'react-native'
import { Stack, useRouter, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import SafeGestureHandlerRootView from '../src/components/SafeGestureHandlerRootView'
import * as Notifications from 'expo-notifications'
import { auth } from '../src/lib/firebase'
import ErrorBoundary from '../src/components/ErrorBoundary'
import { I18nProvider } from '../src/i18n/index'
import { DataSaverProvider } from '../src/contexts/DataSaverContext'
import { colors } from '../src/lib/theme'

import notificationService from '../src/services/notificationService'
import { usePresence } from '../src/hooks/usePresence'
import { useStartup } from '../src/features/startup/hooks/useStartup'
import { useStartupStore } from '../src/features/startup/store/startupStore'
import StartupScreen from '../src/features/startup/components/StartupScreen'

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

function RootContent() {
  const router = useRouter()
  const pathname = usePathname()
  const responseListenerRef = useRef<any>(null)
  usePresence()
  const user = useStartupStore((s) => s.user)

  useEffect(() => {
    setSentryRoute(pathname)
  }, [pathname])

  useEffect(() => {
    if (!user) return

    notificationService.requestPermissions().then((token) => {
      if (token) {
        notificationService.saveToken(user.id, token)
      }
    }).catch(console.error)

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('mbolo', {
        name: 'Mbolo',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00C853',
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
  }, [user, router])

  useEffect(() => {
    setSentryUser(user ? { uid: user.id, email: (user as any).email } : null)
  }, [user])

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      screenListeners={{
        state: (e: any) => {
          if (useStartupStore.getState().phase !== 'ready') return
          const state = e.data.state
          if (!state) return
          const routeName = state.routes[state.index]?.name
          const isAuthRoute = routeName === '(auth)' || routeName === '(auth)/login' || routeName === '(auth)/register'
          const currentUser = useStartupStore.getState().user
          if (!isAuthRoute && !currentUser) {
            InteractionManager.runAfterInteractions(() => {
              router.replace('/(auth)/login')
            })
          } else if (isAuthRoute && currentUser) {
            InteractionManager.runAfterInteractions(() => {
              router.replace('/(tabs)/feed')
            })
          }
        },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="search" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="insights" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="hashtag/[tag]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="u/[pseudo]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
    </Stack>
  )
}

export default function RootLayout() {
  const { logoOpacity, logoScale, feedOpacity, feedScale } = useStartup()

  return (
    <StartupScreen
      logoOpacity={logoOpacity}
      logoScale={logoScale}
      feedOpacity={feedOpacity}
      feedScale={feedScale}
    >
      <SafeGestureHandlerRootView style={{ flex: 1 }}>
        <I18nProvider>
          <DataSaverProvider>
          <ErrorBoundary>
            <StatusBar style="light" backgroundColor={colors.background} />
            <NavigationHistoryProvider>
              <RootContent />
            </NavigationHistoryProvider>
          </ErrorBoundary>
          </DataSaverProvider>
        </I18nProvider>
      </SafeGestureHandlerRootView>
    </StartupScreen>
  )
}
