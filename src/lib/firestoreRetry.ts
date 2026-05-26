export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  context?: string
}

export interface RetryResult<T> {
  data: T | null
  error: { code: string; message: string } | null
  retried: boolean
}

function isIndexError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'failed-precondition'
  )
}

function getErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return (err as { code: string }).code
  }
  return 'unknown'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withFirestoreRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const { maxRetries = 3, baseDelayMs = 2000, context = 'query' } = options
  let lastError: { code: string; message: string } | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn()
      if (attempt > 0) {
        console.debug(
          `[Firestore] ${context}: reussi apres ${attempt} tentative(s)`,
        )
      }
      return { data, error: null, retried: attempt > 0 }
    } catch (err) {
      const code = getErrorCode(err)
      const message = err instanceof Error ? err.message : String(err)
      lastError = { code, message }

      if (!isIndexError(err)) {
        console.debug(`[Firestore] ${context}: ${code} — non réessayable`)
        return { data: null, error: lastError, retried: false }
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.warn(
          `[Firestore] ${context}: index manquant, tentative ${attempt + 1}/${maxRetries} dans ${delay}ms`,
        )
        await sleep(delay)
      }
    }
  }

  console.error(`[Firestore] ${context}: echec apres ${maxRetries + 1} tentatives`)
  return { data: null, error: lastError, retried: true }
}
