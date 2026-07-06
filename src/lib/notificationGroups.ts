import type { Notification as NotificationType } from '../types'

export function groupByTime(items: NotificationType[]) {
  const now = Date.now()
  const day = 86400000
  const groups: { title: string; data: NotificationType[] }[] = [
    { title: "Aujourd'hui", data: [] },
    { title: 'Cette semaine', data: [] },
    { title: 'Plus ancien', data: [] },
  ]
  for (const n of items) {
    const ts = (n.createdAt as any)?.seconds ? (n.createdAt as any).seconds * 1000 : 0
    const age = now - ts
    if (age < day) groups[0].data.push(n)
    else if (age < 7 * day) groups[1].data.push(n)
    else groups[2].data.push(n)
  }
  return groups.filter((g) => g.data.length > 0)
}
