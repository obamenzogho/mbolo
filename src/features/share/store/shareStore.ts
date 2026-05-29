import { create } from 'zustand'

export interface ShareVideoData {
  id: string
  url: string
  description?: string
  thumbnailURL?: string
  userName?: string
}

interface ShareState {
  shareVideo: ShareVideoData | null
  isModalVisible: boolean
  toastMessage: string | null
  toastVisible: boolean

  openShareModal: (data: ShareVideoData) => void
  closeShareModal: () => void
  showToast: (message: string) => void
  hideToast: () => void
}

export const useShareStore = create<ShareState>((set) => ({
  shareVideo: null,
  isModalVisible: false,
  toastMessage: null,
  toastVisible: false,

  openShareModal: (data) => set({ shareVideo: data, isModalVisible: true }),
  closeShareModal: () => set({ isModalVisible: false, shareVideo: null }),
  showToast: (message) => set({ toastMessage: message, toastVisible: true }),
  hideToast: () => set({ toastVisible: false, toastMessage: null }),
}))
