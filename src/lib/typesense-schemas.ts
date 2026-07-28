/**
 * typesense-schemas.ts — Schémas centralisés pour les collections Typesense.
 * Utilisé par le script de sync (scripts/typesense-sync.mjs) et
 * les cloud functions (functions/src/search.ts).
 *
 * Chaque modification de schéma doit passer par ce fichier.
 */

export const USERS_SCHEMA = {
  name: 'users' as const,
  fields: [
    { name: 'pseudo', type: 'string' as const },
    { name: 'nom', type: 'string' as const, optional: true },
    { name: 'bio', type: 'string' as const, optional: true },
    { name: 'city', type: 'string' as const, optional: true },
    { name: 'interests', type: 'string[]' as const, optional: true },
    { name: 'photoURL', type: 'string' as const, optional: true },
    { name: 'verified', type: 'bool' as const },
    { name: 'followerCount', type: 'int32' as const },
  ],
  default_sorting_field: 'followerCount',
}

export const HASHTAGS_SCHEMA = {
  name: 'hashtags' as const,
  fields: [
    { name: 'tag', type: 'string' as const },
    { name: 'videoCount', type: 'int32' as const },
    { name: 'trendingScore', type: 'float' as const },
  ],
  default_sorting_field: 'videoCount',
}

export const POSTS_SCHEMA = {
  name: 'posts' as const,
  fields: [
    { name: 'text', type: 'string' as const },
    { name: 'userName', type: 'string' as const },
    { name: 'userId', type: 'string' as const },
    { name: 'userPhoto', type: 'string' as const, optional: true },
    { name: 'city', type: 'string' as const, optional: true },
    { name: 'hashtags', type: 'string[]' as const, optional: true },
    { name: 'soundId', type: 'string' as const, optional: true },
    { name: 'likeCount', type: 'int32' as const },
    { name: 'commentCount', type: 'int32' as const },
    { name: 'shareCount', type: 'int32' as const },
    { name: 'saveCount', type: 'int32' as const },
    { name: 'viewCount', type: 'int32' as const },
    { name: 'mediaType', type: 'string' as const, optional: true },
    { name: 'mediaUrl', type: 'string' as const, optional: true },
    { name: 'thumbnailUrl', type: 'string' as const, optional: true },
    { name: 'createdAt', type: 'int64' as const },
    { name: 'visibility', type: 'string' as const, optional: true },
    { name: 'moderationStatus', type: 'string' as const, optional: true },
    { name: 'engagementScore', type: 'float' as const, optional: true },
    { name: 'recencyScore', type: 'float' as const, optional: true },
  ],
  default_sorting_field: 'recencyScore',
}

export const VIDEOS_SCHEMA = {
  name: 'videos' as const,
  fields: [
    { name: 'text', type: 'string' as const },
    { name: 'description', type: 'string' as const },
    { name: 'userName', type: 'string' as const },
    { name: 'userId', type: 'string' as const },
    { name: 'userPhoto', type: 'string' as const, optional: true },
    { name: 'city', type: 'string' as const, optional: true },
    { name: 'hashtags', type: 'string[]' as const, optional: true },
    { name: 'soundId', type: 'string' as const, optional: true },
    { name: 'likeCount', type: 'int32' as const },
    { name: 'commentCount', type: 'int32' as const },
    { name: 'shareCount', type: 'int32' as const },
    { name: 'saveCount', type: 'int32' as const },
    { name: 'viewCount', type: 'int32' as const },
    { name: 'mediaType', type: 'string' as const, optional: true },
    { name: 'videoURL', type: 'string' as const },
    { name: 'videoURL_360p', type: 'string' as const, optional: true },
    { name: 'videoURL_480p', type: 'string' as const, optional: true },
    { name: 'thumbnailUrl', type: 'string' as const, optional: true },
    { name: 'createdAt', type: 'int64' as const },
    { name: 'visibility', type: 'string' as const, optional: true },
    { name: 'moderationStatus', type: 'string' as const, optional: true },
    { name: 'engagementScore', type: 'float' as const, optional: true },
    { name: 'recencyScore', type: 'float' as const, optional: true },
    { name: 'hotScore', type: 'float' as const, optional: true },
  ],
  default_sorting_field: 'hotScore',
}

export const SEARCH_FILTER_BY = 'visibility:=public && moderationStatus:!=blocked'

export type SearchCollectionName = 'users' | 'hashtags' | 'posts' | 'videos'