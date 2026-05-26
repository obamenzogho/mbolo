import { useState, useCallback, useRef } from 'react'
import { getCameraModule } from '../../config/modules'
import { captureException } from '../lib/sentry'

const {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} = getCameraModule()

type CameraHandle = any

export interface VisionCameraDevice {
  id: string
  position: 'front' | 'back'
  hasFlash: boolean
  hasTorch: boolean
  supportsVideoHDR: boolean
  supportsPhotoHDR: boolean
  supportsDepthCapture: boolean
  supportsPortraitEffects: boolean
  isoRange: [number, number]
  exposureRange: number
  supportsVideoStabilization: boolean
  videoStabilizationMode: number
}

export interface VideoSettings {
  resolution: 'auto' | 'sd' | 'hd' | 'fhd' | '4k'
  fps: 24 | 30 | 60 | 120
  hdr: boolean
  flash: boolean
}

export interface PhotoSettings {
  flash: 'off' | 'on' | 'auto'
  hdr: boolean
  enableAutoRedEyeReduction: boolean
  enableImageStabilization: boolean
}

export interface VisionCameraResult {
  uri: string
  width: number
  height: number
  isPortrait: boolean
}

export function useVisionCamera() {
  const [facing, setFacing] = useState<'front' | 'back'>('back')

  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission()
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission()

  const frontDevice = useCameraDevice('front')
  const backDevice = useCameraDevice('back')

  const device = facing === 'back' ? backDevice : frontDevice

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const cam = await requestCameraPermission()
    const mic = await requestMicPermission()
    return cam && mic
  }, [requestCameraPermission, requestMicPermission])

  const flipCamera = useCallback(() => {
    setFacing(prev => prev === 'back' ? 'front' : 'back')
  }, [])

  const getDeviceInfo = useCallback(() => {
    if (!device) return null
    return {
      id: device.id,
      position: device.position,
      hasFlash: device.hasFlash || false,
      hasTorch: device.hasTorch || false,
      supportsVideoHDR: (device as any).supportsVideoHDR || false,
      supportsPhotoHDR: (device as any).supportsPhotoHDR || false,
      supportsDepthCapture: (device as any).supportsDepthCapture || false,
      supportsPortraitEffects: (device as any).supportsPortraitEffects || false,
      isoRange: (device as any).isoRange || [100, 3200],
      exposureRange: (device as any).exposureRange || 0,
      supportsVideoStabilization: (device as any).supportsVideoStabilization || false,
    }
  }, [device])

  return {
    device,
    deviceInfo: getDeviceInfo(),
    facing,
    flipCamera,
    requestPermissions,
    hasCameraPermission,
    hasMicPermission,
    frontDevice,
    backDevice,
    setFacing,
  }
}

export function useVisionCameraRecording() {
  const cameraRef = useRef<CameraHandle>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async (options?: {
    onRecordingStarted?: () => void
    onRecordingStopped?: (video: { uri: string }) => void
    onError?: (error: Error) => void
  }) => {
    if (!cameraRef.current || isRecording) return

    try {
      setIsRecording(true)
      setRecordingDuration(0)
      options?.onRecordingStarted?.()

      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

      await cameraRef.current.startRecording({
        onRecordingFinished: (video: { path: string }) => {
          if (durationTimerRef.current) clearInterval(durationTimerRef.current)
          setIsRecording(false)
          setRecordingDuration(0)
          options?.onRecordingStopped?.({ uri: video.path })
        },
        onRecordingError: (error: Error) => {
          if (durationTimerRef.current) clearInterval(durationTimerRef.current)
          setIsRecording(false)
          setRecordingDuration(0)
          options?.onError?.(error)
        },
      })
    } catch (e) {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
      setIsRecording(false)
      options?.onError?.(e as Error)
    }
  }, [isRecording])

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return
    try {
      await cameraRef.current.stopRecording()
    } catch {}
  }, [isRecording])

  return {
    cameraRef,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
  }
}

export function useVisionCameraPhoto() {
  const cameraRef = useRef<CameraHandle>(null)

  const takePhoto = useCallback(async (): Promise<VisionCameraResult | null> => {
    if (!cameraRef.current) return null
    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'quality',
      })
      return {
        uri: photo.path,
        width: photo.width,
        height: photo.height,
        isPortrait: photo.isPortrait || false,
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'takePhoto' })
      console.error('Take photo error:', e)
      return null
    }
  }, [])

  return { cameraRef, takePhoto }
}

export function useVisionCameraZoom() {
  const [zoom, setZoom] = useState(0)
  const minZoomRef = useRef(0)
  const maxZoomRef = useRef(1)

  const setMinZoom = useCallback((value: number) => {
    minZoomRef.current = value
    setZoom(Math.max(value, zoom))
  }, [zoom])

  const setMaxZoom = useCallback((value: number) => {
    maxZoomRef.current = value
    setZoom(Math.min(value, zoom))
  }, [zoom])

  const updateZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(minZoomRef.current, Math.min(maxZoomRef.current, prev + delta)))
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(0)
  }, [])

  return {
    zoom,
    setZoom,
    setMinZoom,
    setMaxZoom,
    updateZoom,
    resetZoom,
    minZoom: minZoomRef.current,
    maxZoom: maxZoomRef.current,
  }
}

export function useVisionCameraFocus() {
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)

  const focusAtPoint = useCallback((x: number, y: number, camera: CameraHandle | null) => {
    setFocusPoint({ x, y })
    if (camera) {
      camera.setFocusPoint({ x, y })
    }
    setTimeout(() => setFocusPoint(null), 2000)
  }, [])

  const clearFocus = useCallback(() => {
    setFocusPoint(null)
  }, [])

  return { focusPoint, focusAtPoint, clearFocus }
}

export function getVideoResolutionLabel(resolution: 'auto' | 'sd' | 'hd' | 'fhd' | '4k'): string {
  const labels = {
    auto: 'Auto',
    sd: 'SD (480p)',
    hd: 'HD (720p)',
    fhd: 'Full HD (1080p)',
    '4k': '4K (2160p)',
  }
  return labels[resolution] || 'Auto'
}

export function getFpsLabel(fps: number): string {
  return `${fps} FPS`
}

export const RESOLUTION_OPTIONS = ['auto', 'sd', 'hd', 'fhd'] as const
export const FPS_OPTIONS = [24, 30, 60] as const
