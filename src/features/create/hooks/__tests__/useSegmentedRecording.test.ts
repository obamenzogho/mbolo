/* useSegmentedRecording.test.ts — Pile de segments d'enregistrement caméra :
   ajout borné par maxDuration, retrait du dernier segment, reset. */

import { act, renderHook } from '@testing-library/react-native'
import { useSegmentedRecording } from '../useSegmentedRecording'

const MAX = 10_000

async function setup(maxDurationMs = MAX) {
  return await renderHook(() => useSegmentedRecording({ maxDurationMs }))
}

describe('useSegmentedRecording', () => {
  it('démarre vide et autorise l’enregistrement', async () => {
    const { result } = await setup()

    expect(result.current.segments).toEqual([])
    expect(result.current.totalDurationMs).toBe(0)
    expect(result.current.remainingDurationMs).toBe(MAX)
    expect(result.current.canRecord).toBe(true)
  })

  it('empile les segments et cumule leur durée', async () => {
    const { result } = await setup()

    await act(async () => {
      result.current.addSegment({ uri: 'file://a.mp4', durationMs: 3000 })
    })
    await act(async () => {
      result.current.addSegment({ uri: 'file://b.mp4', durationMs: 2000 })
    })

    expect(result.current.segments).toEqual([
      { uri: 'file://a.mp4', durationMs: 3000 },
      { uri: 'file://b.mp4', durationMs: 2000 },
    ])
    expect(result.current.totalDurationMs).toBe(5000)
    expect(result.current.remainingDurationMs).toBe(5000)
  })

  it('rejette un segment sans uri ou de durée nulle', async () => {
    const { result } = await setup()

    await act(async () => {
      result.current.addSegment({ uri: '', durationMs: 1000 })
    })
    await act(async () => {
      result.current.addSegment({ uri: 'file://a.mp4', durationMs: 0 })
    })

    expect(result.current.segments).toEqual([])
  })

  it('tronque le dernier segment à la durée restante', async () => {
    const { result } = await setup(4000)

    await act(async () => {
      result.current.addSegment({ uri: 'file://a.mp4', durationMs: 3000 })
    })

    let fullyAccepted: boolean | undefined
    await act(async () => {
      fullyAccepted = result.current.addSegment({
        uri: 'file://b.mp4',
        durationMs: 5000,
      })
    })

    expect(fullyAccepted).toBe(false)
    expect(result.current.segments[1]).toEqual({
      uri: 'file://b.mp4',
      durationMs: 1000,
    })
    expect(result.current.totalDurationMs).toBe(4000)
    expect(result.current.canRecord).toBe(false)
  })

  it('refuse tout nouveau segment une fois la durée max atteinte', async () => {
    const { result } = await setup(2000)

    await act(async () => {
      result.current.addSegment({ uri: 'file://a.mp4', durationMs: 2000 })
    })

    let accepted: boolean | undefined
    await act(async () => {
      accepted = result.current.addSegment({ uri: 'file://b.mp4', durationMs: 1000 })
    })

    expect(accepted).toBe(false)
    expect(result.current.segments).toHaveLength(1)
  })

  it('retourne le segment retiré par removeLastSegment', async () => {
    const { result } = await setup()

    await act(async () => {
      result.current.addSegment({ uri: 'file://a.mp4', durationMs: 3000 })
    })
    await act(async () => {
      result.current.addSegment({ uri: 'file://b.mp4', durationMs: 2000 })
    })

    let removed: { uri: string; durationMs: number } | null = null
    await act(async () => {
      removed = result.current.removeLastSegment()
    })

    expect(removed).toEqual({ uri: 'file://b.mp4', durationMs: 2000 })
    expect(result.current.segments).toHaveLength(1)
    expect(result.current.totalDurationMs).toBe(3000)
  })

  it('retourne null quand il n’y a rien à retirer', async () => {
    const { result } = await setup()

    let removed: { uri: string; durationMs: number } | null = null
    await act(async () => {
      removed = result.current.removeLastSegment()
    })

    expect(removed).toBeNull()
  })

  it('vide la pile avec reset', async () => {
    const { result } = await setup()

    await act(async () => {
      result.current.addSegment({ uri: 'file://a.mp4', durationMs: 3000 })
    })
    await act(async () => {
      result.current.reset()
    })

    expect(result.current.segments).toEqual([])
    expect(result.current.totalDurationMs).toBe(0)
    expect(result.current.canRecord).toBe(true)
  })
})
