import { create } from 'zustand'
import type { Video, User } from '@/types'

export type StartupPhase =
  | 'init'
  | 'native_splash'
  | 'session'
  | 'hydrating'
  | 'preloading'
  | 'ready'
  | 'error'

export interface StartupTiming {
  phase: StartupPhase
  startedAt: number
  elapsed: number
}

interface StartupState {
  phase: StartupPhase
  user: User | null
  error: Error | null
  cachedVideos: Video[]
  // Miniature de la 1re vidéo, préchargée pendant l'écran logo : sert de premier
  // rendu du feed (à la place du loader) tant que les vidéos n'arrivent pas.
  firstThumbnailURL: string | null
  warmStart: boolean
  timing: StartupTiming[]

  setPhase: (phase: StartupPhase) => void
  setUser: (user: User | null) => void
  setError: (error: Error | null) => void
  setCachedVideos: (videos: Video[]) => void
  setFirstThumbnailURL: (url: string | null) => void
  setWarmStart: (warm: boolean) => void
  reset: () => void
}

const initialState = {
  phase: 'init' as StartupPhase,
  user: null as User | null,
  error: null as Error | null,
  cachedVideos: [] as Video[],
  firstThumbnailURL: null as string | null,
  warmStart: false,
  timing: [] as StartupTiming[],
}

export const useStartupStore = create<StartupState>()((set) => ({
  ...initialState,

  setPhase: (phase) =>
    set((state) => ({
      phase,
      timing: [
        ...state.timing,
        { phase, startedAt: Date.now(), elapsed: 0 },
      ],
    })),

  setUser: (user) => set({ user }),
  setError: (error) => set({ error }),
  setCachedVideos: (videos) => set({ cachedVideos: videos }),
  setFirstThumbnailURL: (url) => set({ firstThumbnailURL: url }),
  setWarmStart: (warm) => set({ warmStart: warm }),
  reset: () => set(initialState),
}))
