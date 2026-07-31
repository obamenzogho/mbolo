/* src/features/news/utils/format.ts
   Formatage pur, sans dépendance React. Testable unitairement.
   `timeAgo` prend `now` en paramètre pour être déterministe en test et des
   `labels` i18n optionnels (retour au français si non fournis). */

const MINUTE = 60
const HOUR = 3600
const DAY = 86400
const WEEK = 604800

export interface TimeLabels {
  justNow: string
  minutes: string
  hours: string
  yesterday: string
  days: string
}

const DEFAULT_LABELS: TimeLabels = {
  justNow: "À l'instant",
  minutes: 'Il y a {n} min',
  hours: 'Il y a {n} h',
  yesterday: 'Hier',
  days: 'Il y a {n} j',
}

export function interpolate(template: string, value: number): string {
  return template.replace('{n}', String(value))
}

export function timeAgo(
  date: Date,
  now: number = Date.now(),
  labels: TimeLabels = DEFAULT_LABELS,
): string {
  const seconds = Math.max(1, Math.floor((now - date.getTime()) / 1000))

  if (seconds < MINUTE) return labels.justNow
  if (seconds < HOUR) return interpolate(labels.minutes, Math.floor(seconds / MINUTE))
  if (seconds < DAY) return interpolate(labels.hours, Math.floor(seconds / HOUR))
  if (seconds < DAY * 2) return labels.yesterday
  if (seconds < WEEK) return interpolate(labels.days, Math.floor(seconds / DAY))

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
