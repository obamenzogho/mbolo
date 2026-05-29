import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import Constants from 'expo-constants'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const getProjectId = () => {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.expoConfig?.extra?.projectId || 'mbolo-51177'
}

export const notificationService = {
  requestPermissions: async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device')
      return null
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync() as any
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync() as any
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted')
      return null
    }

    try {
      const projectId = getProjectId()
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      })
      return tokenData.data
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getPushToken' })
      console.error('Error getting push token:', e)
      return null
    }
  },

  saveToken: async (userId: string, token: string): Promise<void> => {
    if (!userId || !token) return
    try {
      await updateDoc(doc(db, 'users', userId), {
        pushToken: token,
        pushTokenUpdatedAt: new Date().toISOString(),
      })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'savePushToken' })
      console.error('Error saving push token:', e)
    }
  },

  deleteToken: async (userId: string): Promise<void> => {
    if (!userId) return
    try {
      await updateDoc(doc(db, 'users', userId), {
        pushToken: null,
        pushTokenUpdatedAt: null,
      })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deletePushToken' })
      console.error('Error deleting push token:', e)
    }
  },

  scheduleLocal: async ({
    title,
    body,
    data,
    subtitle,
  }: {
    title: string
    body: string
    data?: Record<string, any>
    subtitle?: string
  }): Promise<string> => {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        subtitle,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null,
    })
    return id
  },

  scheduleDelayed: async ({
    title,
    body,
    data,
    seconds,
  }: {
    title: string
    body: string
    data?: Record<string, any>
    seconds: number
  }): Promise<string> => {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, seconds),
      },
    })
    return id
  },

  cancelAll: async (): Promise<void> => {
    await Notifications.cancelAllScheduledNotificationsAsync()
  },

  cancelById: async (id: string): Promise<void> => {
    await Notifications.cancelScheduledNotificationAsync(id)
  },

  getBadgeCount: async (): Promise<number> => {
    return await Notifications.getBadgeCountAsync()
  },

  setBadgeCount: async (count: number): Promise<void> => {
    await Notifications.setBadgeCountAsync(count)
  },

  addNotificationReceived: (callback: (notification: Notifications.Notification) => void): Notifications.Subscription => {
    return Notifications.addNotificationReceivedListener(callback)
  },

  addNotificationResponseReceived: (callback: (response: Notifications.NotificationResponse) => void): Notifications.Subscription => {
    return Notifications.addNotificationResponseReceivedListener(callback)
  },

  notify: {
    newFollower: async (username: string, userId?: string, avatarUrl?: string) => {
      return notificationService.scheduleLocal({
        title: '👤 Nouvel abonné',
        body: `${username} s'est abonné à toi`,
        data: { type: 'follow', userId, username, avatarUrl },
      })
    },

    newLike: async (username: string, postId: string, videoTitle?: string) => {
      return notificationService.scheduleLocal({
        title: '❤️ Nouveau like',
        body: videoTitle ? `${username} a aimé "${videoTitle}"` : `${username} a aimé ta vidéo`,
        data: { type: 'like', username, postId },
      })
    },

    newComment: async (username: string, postId: string, commentText: string) => {
      const preview = commentText.length > 50 ? commentText.substring(0, 50) + '...' : commentText
      return notificationService.scheduleLocal({
        title: '💬 Nouveau commentaire',
        body: `${username}: ${preview}`,
        data: { type: 'comment', username, postId },
      })
    },

    newReply: async (username: string, postId: string) => {
      return notificationService.scheduleLocal({
        title: '↩️ Nouvelle réponse',
        body: `${username} a répondu à ton commentaire`,
        data: { type: 'reply', username, postId },
      })
    },

    videoTrending: async (videoTitle: string, postId: string) => {
      return notificationService.scheduleLocal({
        title: '🔥 Vidéo en tendance !',
        body: `Ta vidéo "${videoTitle}" cartonne sur Mbolo 🔥`,
        data: { type: 'trending', postId, videoTitle },
      })
    },

    mention: async (username: string, postId: string, commentText: string) => {
      return notificationService.scheduleLocal({
        title: '🏷️ Mention',
        body: `${username} t'a mentionné : ${commentText.substring(0, 50)}...`,
        data: { type: 'mention', username, postId },
      })
    },

    milestoneReached: async (username: string, milestone: string) => {
      return notificationService.scheduleLocal({
        title: '🎉 Bravo !',
        body: `${milestone} ! Tu es awesome ${username} !`,
        data: { type: 'milestone', milestone },
      })
    },

    newFollowerRequest: async (username: string, userId: string) => {
      return notificationService.scheduleLocal({
        title: '📩 Demande d\'abonnement',
        body: `${username} veut te suivre`,
        data: { type: 'follow_request', userId, username },
      })
    },

    newRepost: async (username: string, postId: string) => {
      return notificationService.scheduleLocal({
        title: '🔄 Republication',
        body: `${username} a republié ta vidéo`,
        data: { type: 'repost', username, postId },
      })
    },

    newShare: async (username: string, postId: string) => {
      return notificationService.scheduleLocal({
        title: '📤 Vidéo partagée',
        body: `${username} a partagé ta vidéo`,
        data: { type: 'share', username, postId },
      })
    },

    videoHighlyShared: async (videoTitle: string, postId: string) => {
      return notificationService.scheduleLocal({
        title: '🚀 Vidéo très partagée !',
        body: `Ta vidéo "${videoTitle}" est très partagée sur Mbolo 🚀`,
        data: { type: 'trending', postId, videoTitle },
      })
    },

    storyViewed: async (count: number) => {
      return notificationService.scheduleLocal({
        title: '👀 Story vu',
        body: count === 1 ? '1 personne a vu ton story' : `${count} personnes ont vu ton story`,
        data: { type: 'story_view', count },
      })
    },
  },
}

export default notificationService
