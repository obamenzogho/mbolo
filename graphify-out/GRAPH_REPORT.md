# Graph Report - .  (2026-07-29)

## Corpus Check
- Enhanced architectural enrichment (roles + features + conventions)

## Summary
- 7499 nodes
- 9986 edges
- 18 roles
- 12 features
- 10 conventions
- 13 Firestore collections
- Extraction: EXTRACTED + INFERRED links
- Token cost: 0 input - 0 output

## God Nodes
1. `Feature: Miscellaneous` - 231 edges
2. `Role: Miscellaneous` - 181 edges
3. `functions/src/index.ts` - 166 edges
4. `scripts/graphify-cli.js` - 147 edges
5. `app/(tabs)/profile.tsx` - 129 edges
6. `functions/src/search.ts` - 113 edges
7. `src/hooks/useComments.ts` - 107 edges
8. `scripts/enrich-graphify-roles.js` - 89 edges
9. `utils/ffmpeg.ts` - 84 edges
10. `src/features/feed/hooks/useFollowingFeedData.ts` - 81 edges
11. `app/user/[userId].tsx` - 80 edges
12. `app/(tabs)/messages.tsx` - 79 edges

## Features
- `Feature: Auth & Onboarding`
- `Feature: Feed & Discovery`
- `Feature: Camera & Capture`
- `Feature: Upload & Editing`
- `Feature: Stories & Highlights`
- `Feature: Profile & Users`
- `Feature: Messages`
- `Feature: Notifications`
- `Feature: Comments & Sharing`
- `Feature: UI System & Theme`
- `Feature: Localization`
- `Feature: Miscellaneous`

## Conventions
- `Convention: File-based Routing (expo-router)`
- `Convention: Custom Hooks pattern (src/hooks/)`
- `Convention: Reusable Components (src/components/)`
- `Convention: API Services (src/services/)`
- `Convention: Core Lib (src/lib/)`
- `Convention: Shared Types (src/types/)`
- `Convention: Utilities (utils/)`
- `Convention: i18n Translations (src/i18n/)`
- `Convention: Firestore Data Layer`
- `Convention: NativeWind + Tailwind + Dark Theme`

## Firestore Collections
- `usernames`
- `users`
- `videos`
- `notifications`
- `stories`
- `highlights`
- `posts`
- `conversations`
- `reposts`
- `shares`
- `reports`
- `analytics_events`
- `hashtags`

## Notes
- Enriched with role, feature, and convention groupings.
- Use `graphify query "<question>"`, `graphify explain "<concept>"`, and `graphify path "<A>" "<B>"`.
- Use `graphify wiki` to read graphify-out/wiki/index.md for full architectural memory.
