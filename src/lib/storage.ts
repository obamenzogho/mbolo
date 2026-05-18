import { Platform } from 'react-native'
import { uploadToCloudinary } from './cloudinary'

export type StorageProvider = 'dev' | 'firebase' | 'cloudinary'

const CURRENT_PROVIDER: StorageProvider = 'cloudinary'

interface UploadResult {
  uri: string
  provider: StorageProvider
}

async function uploadLocal(uri: string): Promise<UploadResult> {
  const localUri = Platform.select({
    ios: uri,
    android: uri,
    default: uri,
  })
  return { uri: localUri, provider: 'dev' }
}

export async function uploadVideo(uri: string): Promise<UploadResult> {
  if (CURRENT_PROVIDER === 'firebase') {
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
    const { storage, auth } = await import('./firebase')

    const userId = auth.currentUser?.uid || 'anonymous'
    const filename = `videos/${userId}/${Date.now()}.mp4`
    const storageRef = ref(storage, filename)

    const response = await fetch(uri)
    const blob = await response.blob()
    await uploadBytes(storageRef, blob)
    const downloadURL = await getDownloadURL(storageRef)

    return { uri: downloadURL, provider: 'firebase' }
  }

  if (CURRENT_PROVIDER === 'cloudinary') {
    const url = await uploadToCloudinary(uri, 'video')
    return { uri: url, provider: 'cloudinary' }
  }

  return uploadLocal(uri)
}

export async function deleteVideo(_uri: string): Promise<void> {
  return
}

export function getStorageProvider(): StorageProvider {
  return CURRENT_PROVIDER
}
