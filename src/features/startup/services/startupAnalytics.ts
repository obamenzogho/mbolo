import { captureException } from '@/lib/sentry'
import type { StartupPhase, StartupTiming } from '../store/startupStore'

let startTime = 0
const marks: Record<string, number> = {}

export function markStartupStart() {
  startTime = Date.now()
  marks['app_launch'] = startTime
}

export function markStartupPhase(phase: string) {
  marks[phase] = Date.now()
}

export function reportStartupComplete(timing: StartupTiming[]) {
  const now = Date.now()
  const total = now - startTime
  const phases: Record<string, number> = {}
  for (const t of timing) {
    phases[t.phase] = t.startedAt - startTime
  }

  if (__DEV__) {
    console.log('[STARTUP] ─────────────────────────')
    console.log('[STARTUP] Total:', total, 'ms')
    for (const [name, ms] of Object.entries(phases)) {
      console.log(`[STARTUP]   ${name}: ${ms}ms`)
    }
    console.log('[STARTUP] ─────────────────────────')
  }
}

export function reportStartupError(error: Error, phase: string) {
  captureException(error, { context: `startup:${phase}` })
}
