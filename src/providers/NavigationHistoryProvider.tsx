import { createContext, ReactNode, useCallback } from 'react'
import { type GestureResponderEvent } from 'react-native'
import { router } from 'expo-router'

interface NavigationHistoryContextType {
  goBack: (eventOrFallback?: GestureResponderEvent | string) => void
}

export const NavigationHistoryContext = createContext<NavigationHistoryContextType>({
  goBack: () => {},
})

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const goBack = useCallback((eventOrFallback: GestureResponderEvent | string = '/(tabs)/feed') => {
    const fallback = typeof eventOrFallback === 'string' ? eventOrFallback : '/(tabs)/feed'
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace(fallback as any)
    }
  }, [])

  return (
    <NavigationHistoryContext.Provider value={{ goBack }}>
      {children}
    </NavigationHistoryContext.Provider>
  )
}
