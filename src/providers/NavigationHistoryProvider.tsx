import { createContext, ReactNode, useCallback, useEffect, useRef } from 'react'
import { router, usePathname } from 'expo-router'

interface NavigationHistoryContextType {
  goBack: () => void
}

export const NavigationHistoryContext = createContext<NavigationHistoryContextType>({
  goBack: () => {},
})

const MAX_HISTORY = 20

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const historyRef = useRef<string[]>([])

  useEffect(() => {
    const hist = historyRef.current
    if (hist[hist.length - 1] !== pathname) {
      hist.push(pathname)
      if (hist.length > MAX_HISTORY) hist.shift()
    }
  }, [pathname])

  const goBack = useCallback(() => {
    const hist = historyRef.current
    if (hist.length < 2) {
      router.push('/(tabs)/feed')
      return
    }
    hist.pop()
    const previous = hist[hist.length - 1]
    router.push(previous as any)
  }, [])

  return (
    <NavigationHistoryContext.Provider value={{ goBack }}>
      {children}
    </NavigationHistoryContext.Provider>
  )
}
