import { useCallback, useMemo, useState } from 'react'
import type { RecordingSegment } from '../types/editing'

export interface SegmentedRecordingState {
  segments: RecordingSegment[]
  totalDurationMs: number
  remainingDurationMs: number
  canRecord: boolean
}

interface UseSegmentedRecordingOptions {
  maxDurationMs: number
}

export function useSegmentedRecording({
  maxDurationMs,
}: UseSegmentedRecordingOptions): SegmentedRecordingState & {
  addSegment: (segment: RecordingSegment) => boolean
  removeLastSegment: () => RecordingSegment | null
  reset: () => void
} {
  const [segments, setSegments] = useState<RecordingSegment[]>([])

  const totalDurationMs = useMemo(
    () => segments.reduce((total, segment) => total + segment.durationMs, 0),
    [segments],
  )
  const remainingDurationMs = Math.max(0, maxDurationMs - totalDurationMs)

  const addSegment = useCallback(
    (segment: RecordingSegment): boolean => {
      if (!segment.uri || segment.durationMs <= 0) return false

      const acceptedDuration = Math.min(segment.durationMs, remainingDurationMs)
      if (acceptedDuration <= 0) return false

      setSegments((current) => [
        ...current,
        { uri: segment.uri, durationMs: acceptedDuration },
      ])
      return acceptedDuration === segment.durationMs
    },
    [remainingDurationMs],
  )

  const removeLastSegment = useCallback((): RecordingSegment | null => {
    const removed = segments.length > 0 ? segments[segments.length - 1] : null
    if (!removed) return null

    setSegments((current) => current.slice(0, -1))
    return removed
  }, [segments])

  const reset = useCallback(() => {
    setSegments([])
  }, [])

  return {
    segments,
    totalDurationMs,
    remainingDurationMs,
    canRecord: remainingDurationMs > 0,
    addSegment,
    removeLastSegment,
    reset,
  }
}
