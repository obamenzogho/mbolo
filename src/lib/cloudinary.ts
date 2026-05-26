import { captureUploadError, startTransaction } from './sentry'

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || ''
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''

async function compressImage(uri: string, quality: number): Promise<string> {
  try {
    const ImageManipulator = require('expo-image-manipulator')
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { maxWidth: 1920, maxHeight: 1920 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    )
    return result.uri
  } catch {
    return uri
  }
}

export interface UploadOptions {
  folder?: string
  timeout?: number
  quality?: number
  onProgress?: (progress: number) => void
  compress?: boolean
}

interface CloudinaryResponse {
  secure_url: string
  public_id: string
  format: string
  error?: { message?: string }
  duration?: number
  bytes: number
  width: number
  height: number
}

export function isCloudinaryConfigured(): boolean {
  return !!(CLOUD_NAME && UPLOAD_PRESET)
}

function getFileUri(uri: string): string {
  if (uri.startsWith('file://') || uri.startsWith('http') || uri.startsWith('content://')) {
    return uri
  }
  return 'file://' + uri
}

function detectResourceType(uri: string): 'video' | 'image' {
  const videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm']
  const lower = uri.toLowerCase()
  return videoExts.some(ext => lower.includes(ext)) ? 'video' : 'image'
}

export async function uploadToCloudinary(
  uri: string,
  resourceType?: 'video' | 'image',
  options: UploadOptions = {}
): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary non configuré. Vérifie ton fichier .env')
  }

  const type = resourceType || detectResourceType(uri)
  const ext = type === 'video' ? 'mp4' : 'jpg'
  const filename = `upload_${Date.now()}.${ext}`
  const endpoint = type === 'video' ? 'video/upload' : 'image/upload'
  const folder = options.folder || (type === 'video' ? 'reels' : 'images')

  let finalUri = uri
  if (options.compress && type === 'image') {
    finalUri = await compressImage(uri, options.quality || 0.8)
  }

  const formData = new FormData()
  formData.append('file', {
    uri: getFileUri(finalUri),
    type: type === 'video' ? 'video/mp4' : 'image/jpeg',
    name: filename,
  } as any)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', folder)

  const timeout = options.timeout || 180000

  const uploadSpan = startTransaction('upload.cloudinary', type)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpoint}`)

    if (options.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && options.onProgress) {
          options.onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      try {
        const data: CloudinaryResponse = JSON.parse(xhr.responseText)
        if (data.secure_url) {
          uploadSpan?.finish()
          resolve(data.secure_url)
        } else {
          const err = new Error(data.error?.message || 'Upload failed')
          captureUploadError(err, { type, size: data.bytes })
          uploadSpan?.finish()
          reject(err)
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error('Parse error')
        captureUploadError(err, { type })
        uploadSpan?.finish()
        reject(err)
      }
    }
    xhr.onerror = () => {
      const err = new Error('XHR error')
      captureUploadError(err, { type })
      uploadSpan?.finish()
      reject(err)
    }
    xhr.ontimeout = () => {
      const err = new Error('Timeout')
      captureUploadError(err, { type })
      uploadSpan?.finish()
      reject(err)
    }
    xhr.timeout = timeout
    xhr.send(formData)
  })
}

export function getCloudinaryConfig() {
  return { cloudName: CLOUD_NAME, configured: !!CLOUD_NAME }
}
