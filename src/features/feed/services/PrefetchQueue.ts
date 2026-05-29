/* PrefetchQueue — file prioritaire des téléchargements de préfetch.
   Rôle : exécute 1 tâche à la fois, suspension pour CRITICAL (priority=3),
   AbortController par tâche. Backoff exponentiel sur retry (3 max).
   Aborted flag pour annulation propre pendant délai de retry.
   Reset retryCount sur re-enqueue.
   Mesure le débit et appelle NetworkQuality.update(). */

import { FEED_DEBUG } from '../store/feedStore'
import { NetworkQuality } from './NetworkQuality'

type Priority = 1 | 2 | 3

const RETRY_DELAYS_MS = [500, 1500, 4000] as const
const MAX_RETRIES = RETRY_DELAYS_MS.length

interface Task {
  videoId: string
  uri: string
  priority: Priority
  controller: AbortController
  retryCount: number
  lastErrorAt: number | null
  aborted: boolean
}

let activeTask: Task | null = null
let suspendedTask: Task | null = null
let scheduledTimeout: ReturnType<typeof setTimeout> | null = null
let retryingTask: Task | null = null

const queue: Task[] = []

function sortByPriority() {
  queue.sort((a, b) => b.priority - a.priority)
}

function processNext() {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout)
    scheduledTimeout = null
  }

  if (activeTask) return

  const task = queue.shift()
  if (!task) return

  executeTask(task)
}

async function executeTask(task: Task) {
  activeTask = task
  if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: START', task.videoId, 'priority:', task.priority)
  const t0 = Date.now()

  try {
    const headers: Record<string, string> = {}
    if (task.priority === 2) {
      headers['Range'] = 'bytes=0-524287'
    } else if (task.priority === 1) {
      headers['Range'] = 'bytes=0-0'
    }

    const resp = await fetch(task.uri, {
      method: 'GET',
      headers,
      signal: task.controller.signal,
    })

    if (resp.ok || resp.status === 206) {
      let bytes = 0
      if (task.priority === 3) {
        const buf = await resp.arrayBuffer()
        bytes = buf.byteLength
      } else if (task.priority === 2) {
        const buf = await resp.arrayBuffer()
        bytes = buf.byteLength
      } else {
        const text = await resp.text()
        bytes = text.length
      }
      const elapsed = (Date.now() - t0) / 1000
      if (elapsed > 0 && bytes > 0) {
        const mbps = (bytes / 1_000_000) / elapsed
        NetworkQuality.update(mbps)
      }
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: COMPLETE', task.videoId, 'priority:', task.priority)
    } else {
      throw new Error('HTTP ' + resp.status)
    }
  } catch (err: unknown) {
    const isAbortError =
      (err instanceof Error && err.name === 'AbortError')
      || (typeof err === 'object' && err !== null
          && (err as { name?: string }).name === 'AbortError')

    if (isAbortError) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: CANCEL', task.videoId)
      activeTask = null
      processNext()
      return
    }

    task.retryCount++
    task.lastErrorAt = Date.now()

    if (task.retryCount <= MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[task.retryCount - 1]
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: error, retry', task.retryCount, '/', MAX_RETRIES, 'in', delay, 'ms', task.videoId)
      activeTask = null
      retryingTask = task
      scheduledTimeout = setTimeout(() => {
        scheduledTimeout = null
        if (task.aborted) {
          if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: retry cancelled (aborted during delay) →', task.videoId)
          processNext()
          return
        }
        retryingTask = null
        queue.unshift(task)
        sortByPriority()
        processNext()
      }, delay)
      return
    } else {
      task.aborted = true
      activeTask = null
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: ABANDONED after', MAX_RETRIES, 'retries →', task.videoId)
    }
  } finally {
    if (activeTask === task) {
      activeTask = null
    }

    if (retryingTask === task) {
      retryingTask = null
    }

    if (!scheduledTimeout && !task.aborted) {
      if (suspendedTask) {
        const resume = suspendedTask
        suspendedTask = null
        queue.unshift(resume)
        sortByPriority()
        processNext()
      } else {
        processNext()
      }
    } else if (task.aborted && !scheduledTimeout) {
      processNext()
    }
  }
}

export const PrefetchQueue = {
  enqueue(videoId: string, uri: string, priority: Priority) {
    if (activeTask?.videoId === videoId) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: enqueue skip (already executing) →', videoId)
      if (priority > activeTask.priority) {
        activeTask.priority = priority
        if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: priority upgraded on active task →', videoId, priority)
      }
      return
    }
    if (retryingTask?.videoId === videoId || suspendedTask?.videoId === videoId) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: enqueue skip (retrying/suspended) →', videoId)
      return
    }

    const existing = queue.find((t) => t.videoId === videoId)
    if (existing) {
      if (priority > existing.priority) {
        existing.priority = priority
        sortByPriority()
      }
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: enqueue (existing)', videoId, 'priority:', priority)
      return
    }

    if (priority === 3 && activeTask && activeTask.priority < 3) {
      activeTask.controller.abort()
      if (FEED_DEBUG && activeTask.retryCount > 0) console.log('[FEED_DEBUG] PREFETCH: suspend (retries:', activeTask.retryCount, ')', activeTask.videoId, 'for CRITICAL', videoId)
      suspendedTask = activeTask
      activeTask = null
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: suspend', suspendedTask.videoId, 'for CRITICAL', videoId)
    }

    const task: Task = {
      videoId,
      uri,
      priority,
      controller: new AbortController(),
      retryCount: 0,
      lastErrorAt: null,
      aborted: false,
    }
    queue.push(task)
    sortByPriority()
    if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: enqueue', videoId, 'priority:', priority)
    processNext()
  },

  cancel(videoId: string) {
    if (retryingTask && retryingTask.videoId === videoId) {
      retryingTask.aborted = true
      if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: CANCEL + aborted flag set →', videoId)
      retryingTask = null
      return
    }

    const idx = queue.findIndex((t) => t.videoId === videoId)
    if (idx !== -1) {
      const removed = queue.splice(idx, 1)[0]
      removed.aborted = true
      removed.controller.abort()
      return
    }

    if (activeTask && activeTask.videoId === videoId) {
      activeTask.aborted = true
      activeTask.controller.abort()
      activeTask = null
    }

    if (suspendedTask && suspendedTask.videoId === videoId) {
      suspendedTask.aborted = true
      suspendedTask.controller.abort()
      suspendedTask = null
    }
  },

  pausePriority(level: number) {
    for (const task of queue) {
      if (task.priority <= level) {
        task.controller.abort()
      }
    }
  },

  clear() {
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout)
      scheduledTimeout = null
    }
    for (const task of queue) task.controller.abort()
    if (activeTask) { activeTask.aborted = true; activeTask.controller.abort(); activeTask = null }
    if (suspendedTask) { suspendedTask.aborted = true; suspendedTask.controller.abort(); suspendedTask = null }
    if (retryingTask) { retryingTask.aborted = true; retryingTask = null }
    queue.length = 0
  },
}
