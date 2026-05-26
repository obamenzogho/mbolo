import React, { createContext, useContext, useState, useCallback } from 'react'
import { Modal } from 'react-native'
import CreateModalContent from '../components/create/CreateModal'

interface CreateModalContextValue {
  openCreateModal: () => void
  closeCreateModal: () => void
}

const CreateModalContext = createContext<CreateModalContextValue>({
  openCreateModal: () => {},
  closeCreateModal: () => {},
})

export function useCreateModal() {
  return useContext(CreateModalContext)
}

export function CreateModalProvider({ children }: { children: React.ReactNode }) {
  const [showCreate, setShowCreate] = useState(false)
  const openCreateModal = useCallback(() => setShowCreate(true), [])
  const closeCreateModal = useCallback(() => setShowCreate(false), [])

  return (
    <CreateModalContext.Provider value={{ openCreateModal, closeCreateModal }}>
      {children}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={closeCreateModal}
      >
        <CreateModalContent onClose={closeCreateModal} />
      </Modal>
    </CreateModalContext.Provider>
  )
}
