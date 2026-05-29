import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@mbolo_dataSaver'

interface DataSaverContextValue {
  isEnabled: boolean
  toggle: () => void
}

const DataSaverContext = createContext<DataSaverContextValue>({
  isEnabled: false,
  toggle: () => {},
})

export function useDataSaver() {
  return useContext(DataSaverContext)
}

export function DataSaverProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'true') setIsEnabled(true)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEY, next ? 'true' : 'false').catch(() => {})
      return next
    })
  }, [])

  return (
    <DataSaverContext.Provider value={{ isEnabled: loaded ? isEnabled : false, toggle }}>
      {children}
    </DataSaverContext.Provider>
  )
}
