import { Share } from 'react-native'

type ShareOptions = {
  message: string
  excludedActivityTypes?: string[]
}

type ShareResult = { success: boolean; dismissedAction?: boolean }

export async function openShare(options: ShareOptions): Promise<ShareResult> {
  const result = await Share.share({ message: options.message })
  return { success: result.action === Share.sharedAction }
}
