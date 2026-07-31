/* src/features/news/utils/format.ts
   Formatage pur, sans dépendance React. Testable unitairement.
   `timeAgo` prend `now` en paramètre pour être déterministe en test. */

const MINUTE = 60
const HOUR = 3600
const DAY = 86400
const WEEK = 604800

export function timeAgo(date: Date, now: number = Date.now()): string {
  const seconds = Math.max(1, Math.floor((now - date.getTime()) / 1000))

  if (seconds < MINUTE) return "À l'instant"
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)} min`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)} h`
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)} j`

  const sameYear = date.getFullYear() === new Date(now).getFullYear()

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Version longue pour les lecteurs d'écran : « il y a 3 heures » reste flou à l'oral. */
export function absoluteDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* Intl.NumberFormat notation:'compact' n'est pas fiable sur Hermes/Android.
   Formatage manuel, séparateur décimal français. */
function short(value: number, divisor: number, unit: string): string {
  const scaled = value / divisor
  const rendered =
    scaled < 10
      ? scaled.toFixed(1).replace(/\.0$/, '').replace('.', ',')
      : String(Math.round(scaled))

  return `${rendered} ${unit}`
}

export function formatCount(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return short(value, 1000, 'k')

  return short(value, 1_000_000, 'M')
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count > 1 ? (pluralForm ?? `${singular}s`) : singular
}

/** « 3 commentaires », « 1 partage » */
export function countLabel(count: number, singular: string, pluralForm?: string): string {
  return `${formatCount(count)} ${plural(count, singular, pluralForm)}`
}
