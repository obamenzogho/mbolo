import { render } from '@testing-library/react-native'
import React, { useEffect } from 'react'
import { useFeedItemActions } from '../useFeedItemActions'
import type { Video } from '../../../../../types'

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'video-ref'),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  increment: jest.fn((n: number) => ({ __increment: n })),
  arrayUnion: jest.fn((v: string) => ({ __arrayUnion: v })),
  arrayRemove: jest.fn((v: string) => ({ __arrayRemove: v })),
}))

jest.mock('../../../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'me' } },
}))

jest.mock('../../../../../lib/notifications', () => ({
  createNotification: jest.fn(),
}))

jest.mock('../../../../../lib/sentry', () => ({
  captureException: jest.fn(),
}))

import { updateDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { createNotification } from '../../../../../lib/notifications'
import { captureException } from '../../../../../lib/sentry'

const mockUpdateDoc = updateDoc as jest.Mock
const mockSetDoc = setDoc as jest.Mock
const mockDeleteDoc = deleteDoc as jest.Mock
const mockCreateNotification = createNotification as jest.Mock
const mockCaptureException = captureException as jest.Mock

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'vid1',
    userId: 'author',
    likes: 10,
    saves: 4,
    comments: 2,
    likedBy: [],
    savedBy: [],
    ...(overrides as any),
  } as Video
}

beforeEach(() => {
  jest.clearAllMocks()
})

async function renderActions(video: Video) {
  const ref: { current: ReturnType<typeof useFeedItemActions> | null } = { current: null }
  function Harness() {
    const r = useFeedItemActions(video)
    useEffect(() => { ref.current = r })
    ref.current = r
    return null
  }
  await render(React.createElement(Harness))
  return ref
}

describe('useFeedItemActions', () => {
  it('initialise l\'état depuis le contenu de la vidéo', async () => {
    const ref = await renderActions(makeVideo({ likedBy: ['me'], savedBy: [], likes: 10, saves: 4 }))
    expect(ref.current!.liked).toBe(true)
    expect(ref.current!.saved).toBe(false)
    expect(ref.current!.likeCount).toBe(10)
    expect(ref.current!.saveCount).toBe(4)
  })

  it('like optimiste: incrémente le compteur et écrit sur Firestore', async () => {
    const ref = await renderActions(makeVideo())
    expect(ref.current!.liked).toBe(false)
    expect(ref.current!.likeCount).toBe(10)

    await React.act(async () => {
      await ref.current!.toggleLike()
    })

    expect(ref.current!.liked).toBe(true)
    expect(ref.current!.likeCount).toBe(11)
    expect(mockSetDoc).toHaveBeenCalledWith(
      'video-ref',
      { createdAt: expect.any(Number) },
    )
    expect(mockUpdateDoc).toHaveBeenCalledWith('video-ref', {
      likes: { __increment: 1 },
    })
    expect(mockCreateNotification).toHaveBeenCalledWith({
      userId: 'author',
      type: 'like',
      fromUserId: 'me',
      videoId: 'vid1',
    })
  })

  it('unlike: décrémente et retire l\'utilisateur, sans notif', async () => {
    const ref = await renderActions(makeVideo({ likedBy: ['me'], likes: 10 }))
    expect(ref.current!.liked).toBe(true)

    await React.act(async () => {
      await ref.current!.toggleLike()
    })

    expect(ref.current!.liked).toBe(false)
    expect(ref.current!.likeCount).toBe(9)
    expect(mockDeleteDoc).toHaveBeenCalledWith('video-ref')
    expect(mockUpdateDoc).toHaveBeenCalledWith('video-ref', {
      likes: { __increment: -1 },
    })
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('force=true ne fait rien si déjà liké', async () => {
    const ref = await renderActions(makeVideo({ likedBy: ['me'], likes: 10 }))

    await React.act(async () => {
      await ref.current!.toggleLike({ force: true })
    })

    expect(ref.current!.likeCount).toBe(10)
    expect(mockSetDoc).not.toHaveBeenCalled()
    expect(mockUpdateDoc).not.toHaveBeenCalled()
  })

  it('rollback du like si Firestore échoue', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('network down'))
    const ref = await renderActions(makeVideo({ likes: 10 }))

    await React.act(async () => {
      await ref.current!.toggleLike()
    })

    expect(ref.current!.liked).toBe(false)
    expect(ref.current!.likeCount).toBe(10)
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      { context: 'toggleLike' },
    )
  })

  it('save optimiste: incrémente et écrit sur Firestore', async () => {
    const ref = await renderActions(makeVideo({ saves: 4 }))

    await React.act(async () => {
      await ref.current!.toggleSave()
    })

    expect(ref.current!.saved).toBe(true)
    expect(ref.current!.saveCount).toBe(5)
    expect(mockSetDoc).toHaveBeenCalledWith(
      'video-ref',
      { createdAt: expect.any(Number) },
    )
    expect(mockUpdateDoc).toHaveBeenCalledWith('video-ref', {
      saves: { __increment: 1 },
    })
  })

  it('rollback du save si Firestore échoue', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('boom'))
    const ref = await renderActions(makeVideo({ saves: 4 }))

    await React.act(async () => {
      await ref.current!.toggleSave()
    })

    expect(ref.current!.saved).toBe(false)
    expect(ref.current!.saveCount).toBe(4)
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      { context: 'toggleSave' },
    )
  })

  it('le compteur ne descend jamais sous zéro', async () => {
    const ref = await renderActions(makeVideo({ likedBy: ['me'], likes: 0 }))

    await React.act(async () => {
      await ref.current!.toggleLike()
    })

    expect(ref.current!.likeCount).toBe(0)
    expect(mockDeleteDoc).toHaveBeenCalledWith('video-ref')
  })
})
