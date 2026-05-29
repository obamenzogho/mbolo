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
  warmStart: boolean
  timing: StartupTiming[]

  setPhase: (phase: StartupPhase) => void
  setUser: (user: User | null) => void
  setError: (error: Error | null) => void
  setCachedVideos: (videos: Video[]) => void
  setWarmStart: (warm: boolean) => void
  reset: () => void
}

const initialState = {
  phase: 'init' as StartupPhase,
  user: null as User | null,
  error: null as Error | null,
  cachedVideos: [] as Video[],
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
  setWarmStart: (warm) => set({ warmStart: warm }),
  reset: () => set(initialState),
}))
