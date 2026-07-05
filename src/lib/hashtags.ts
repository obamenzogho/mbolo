const HASHTAG_REGEX = /#([\p{L}\p{N}_]+)/gu

export function normalizeTag(raw: string): string {
  return raw
    .replace(/^#/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .slice(0, 50)
}

export function extractHashtags(text: string): string[] {
  if (!text) return []
  const matches = text.matchAll(HASHTAG_REGEX)
  const tags = new Set<string>()
  for (const m of matches) {
    const tag = normalizeTag(m[1])
    if (tag.length >= 2 && tag.length <= 50) tags.add(tag)
  }
  return [...tags].slice(0, 30)
}

export function displayTag(tag: string): string {
  return '#' + tag
}
