import React, { createContext, useContext, useCallback } from 'react'
import { router } from 'expo-router'

interface CreateModalContextValue {
  openCreateModal: () => void
}

const CreateModalContext = createContext<CreateModalContextValue>({
  openCreateModal: () => {},
})

export function useCreateModal() {
  return useContext(CreateModalContext)
}

export function CreateModalProvider({ children }: { children: React.ReactNode }) {
  const openCreateModal = useCallback(() => {
    router.push('/news-compose' as never)
  }, [])

  return (
    <CreateModalContext.Provider value={{ openCreateModal }}>
      {children}
    </CreateModalContext.Provider>
  )
}
