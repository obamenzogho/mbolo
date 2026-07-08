import { captureException } from '../lib/sentry'
import notificationService from './notificationService'
import { markNotificationRead, markAllNotificationsRead } from './notificationActions'

export async function markAsRead(notificationId: string): Promise<void> {
  await markNotificationRead(notificationId)
}

export async function markAllAsRead(userId: string): Promise<void> {
  if (!userId) return
  try {
    await markAllNotificationsRead()
    await notificationService.setBadgeCount(0)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'markAllAsRead' })
  }
}
