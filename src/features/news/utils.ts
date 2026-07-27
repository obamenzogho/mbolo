import type { Timestamp } from 'firebase/firestore'

export function toDate(value: Timestamp | Date | number | null | undefined): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof (value as any).toDate === 'function') return (value as any).toDate()
  if (typeof (value as any).seconds === 'number') return new Date((value as any).seconds * 1000)
  return new Date(value as any)
}
