import * as Sentry from '@sentry/react-native'
import { auth } from './firebase'

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || ''

export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN
}

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] DSN non configuré. Sentry désactivé.')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
    attachStacktrace: true,
    enableAutoPerformanceTracing: true,
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value
        || (typeof event.message === 'string' ? event.message : '')
        || ''
      const ignored = [
        'Non-Error exception captured',
        'Network request failed',
        'AbortError',
        'ChunkLoadError',
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Script error.',
        'NotFoundError',
        'upstream connect error',
        'Invalid view returned from registry',
      ]
      if (ignored.some(i => msg.includes(i))) return null
      return event
    },
  })
}

export function setSentryUser(user: { uid: string; email?: string | null; displayName?: string | null } | null): void {
  if (!isSentryEnabled()) return
  if (user) {
    Sentry.setUser({
      id: user.uid,
      email: user.email || undefined,
      username: user.displayName || undefined,
    })
  } else {
    Sentry.setUser(null)
  }
}

export function setSentryRoute(routeName: string): void {
  if (!isSentryEnabled()) return
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Route: ${routeName}`,
    level: 'info',
  })
  Sentry.setTag('current_route', routeName)
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!isSentryEnabled()) {
    console.warn('[Sentry] Exception non envoyée (DSN manquant):', error.message)
    return
  }
  Sentry.captureException(error, {
    extra: context,
    tags: {
      ...(auth.currentUser ? { user_id: auth.currentUser.uid } : {}),
    },
  })
}

export function captureUploadError(error: Error, fileInfo: { type: string; size?: number }): void {
  captureException(error, {
    upload_type: fileInfo.type,
    upload_size: fileInfo.size,
    provider: 'cloudinary',
  })
}

export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'error'): void {
  if (!isSentryEnabled()) return
  Sentry.captureMessage(message, level)
}

export function startTransaction(name: string, op: string) {
  if (!isSentryEnabled()) return null
  
  // compatibility with both Sentry v6 and v8
  if (typeof (Sentry as any).startTransaction === 'function') {
    const transaction = (Sentry as any).startTransaction({ name, op })
    return {
      finish: () => {
        if (transaction && typeof transaction.end === 'function') {
          transaction.end()
        }
      },
    }
  }
  
  if (typeof (Sentry as any).startInactiveSpan === 'function') {
    const span = (Sentry as any).startInactiveSpan({ name, op })
    return {
      finish: () => {
        if (span && typeof span.end === 'function') {
          span.end()
        }
      }
    }
  }
  
  return null
}

export { Sentry }
