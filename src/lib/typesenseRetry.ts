/**
 * typesenseRetry.ts — Wrapper de retry pour les requêtes Typesense.
 *
 * Typesense JS client throw des erreurs avec des propriétés comme `httpStatus`.
 * On retry sur :
 *   - 429 (Too Many Requests)
 *   - 503 (Service Unavailable)
 *   - 504 (Gateway Timeout)
 *   - Network errors / timeouts
 *
 * Backoff exponentiel : 500ms, 1s, 2s
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  context?: string
}

export interface RetryResult<T> {
  data: T | null
  error: { httpStatus: number; message: string } | null
  retried: boolean
}

function isRetryable(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const status =
      (err as { httpStatus?: number }).httpStatus ??
      (err as { status?: number }).status
    if (status === 429 || status === 503 || status === 504) return true
  }
  // Network / timeout errors
  const msg = err instanceof Error ? err.message : String(err)
  if (
    msg.includes('Network') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed')
  ) {
    return true
  }
  return false
}

function getErrorInfo(err: unknown): { httpStatus: number; message: string } {
  if (typeof err === 'object' && err !== null) {
    const status =
      (err as { httpStatus?: number }).httpStatus ??
      (err as { status?: number }).status ??
      0
    const message = err instanceof Error ? err.message : String(err)
    return { httpStatus: status, message }
  }
  return { httpStatus: 0, message: String(err) }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withTypesenseRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const { maxRetries = 3, baseDelayMs = 500, context = 'typesense' } = options
  let lastError: { httpStatus: number; message: string } | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn()
      return { data, error: null, retried: attempt > 0 }
    } catch (err) {
      lastError = getErrorInfo(err)

      if (!isRetryable(err)) {
        return { data: null, error: lastError, retried: attempt > 0 }
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.warn(
          `[Typesense] ${context}: ${lastError.httpStatus} — retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
        )
        await sleep(delay)
      }
    }
  }

  console.error(
    `[Typesense] ${context}: failed after ${maxRetries + 1} attempts`,
  )
  return { data: null, error: lastError, retried: true }
}
