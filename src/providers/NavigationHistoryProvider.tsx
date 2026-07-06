import { createContext, ReactNode, useCallback } from 'react'
import { router } from 'expo-router'

interface NavigationHistoryContextType {
  goBack: (fallback?: string) => void
}

export const NavigationHistoryContext = createContext<NavigationHistoryContextType>({
  goBack: () => {},
})

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const goBack = useCallback((fallback: string = '/(tabs)/feed') => {
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
