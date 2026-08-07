# Graph Report - .  (2026-08-07)

## Corpus Check
- Enhanced architectural enrichment (roles + features + conventions)

## Summary
- 9424 nodes
- 12639 edges
- 18 roles
- 12 features
- 10 conventions
- 14 Firestore collections
- Extraction: EXTRACTED + INFERRED links
- Token cost: 0 input - 0 output

## God Nodes
1. `Feature: Miscellaneous` - 317 edges
2. `Role: Miscellaneous` - 267 edges
3. `functions/src/index.ts` - 155 edges
4. `scripts/graphify-cli.js` - 147 edges
5. `functions/lib/functions/src/index.js` - 134 edges
6. `app/(tabs)/profile.tsx` - 129 edges
7. `src/features/news/components/compose/ComposeCamera.tsx` - 124 edges
8. `functions/src/search.ts` - 113 edges
9. `src/hooks/useComments.ts` - 107 edges
10. `functions/lib/functions/src/search.js` - 105 edges
11. `scripts/enrich-graphify-roles.js` - 89 edges
12. `app/create.tsx` - 87 edges

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
- `sounds`
- `reposts`
- `shares`
- `reports`
- `analytics_events`
- `hashtags`

## Notes
- Enriched with role, feature, and convention groupings.
- Use `graphify query "<question>"`, `graphify explain "<concept>"`, and `graphify path "<A>" "<B>"`.
- Use `graphify wiki` to read graphify-out/wiki/index.md for full architectural memory.
