/* eslint-disable no-console */
/**
 * Crash debug — global error handlers for development.
 * Catches unhandled errors and rejections in development mode.
 */

// ── Global error handlers ──────────────────────────────────────
const origErrorHandler = ErrorUtils.getGlobalHandler?.()

ErrorUtils.setGlobalHandler?.((error: any, isFatal?: boolean) => {
  if (__DEV__) {
    console.warn(`[MBOLO] GLOBAL ERROR (fatal=${isFatal}):`, error?.message ?? String(error))
    console.warn('[MBOLO] Stack:', error?.stack ?? 'no stack')
  }
  origErrorHandler?.(error, isFatal)
})

if (typeof globalThis !== 'undefined') {
  const g = globalThis as any
  if (!g.__moloDebugRejectionInstalled) {
    g.__moloDebugRejectionInstalled = true
    g.addEventListener?.('unhandledrejection', (e: any) => {
      if (__DEV__) {
        console.warn('[MBOLO] UNHANDLED REJECTION:', e?.reason?.message ?? e?.reason ?? e)
      }
    })
  }
}
