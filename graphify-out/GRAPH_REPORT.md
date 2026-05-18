# Graph Report - .  (2026-05-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 247 nodes · 343 edges · 25 communities (22 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `colors` - 22 edges
2. `db` - 21 edges
3. `expo` - 14 edges
4. `scripts` - 5 edges
5. `compilerOptions` - 5 edges
6. `useHighlights()` - 5 edges
7. `uploadVideo()` - 5 edges
8. `Video` - 5 edges
9. `splash` - 4 edges
10. `ios` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Feed()` --calls--> `useVideoFeed()`  [EXTRACTED]
  app/(tabs)/feed.tsx → src/hooks/useVideoFeed.ts
- `Feed()` --calls--> `useVideoPreloader()`  [EXTRACTED]
  app/(tabs)/feed.tsx → src/hooks/useVideoPreloader.ts
- `StoryUploadScreen()` --calls--> `useStories()`  [EXTRACTED]
  app/(tabs)/story-upload.tsx → src/hooks/useStories.ts
- `StoryUploadScreen()` --calls--> `useHighlights()`  [EXTRACTED]
  app/(tabs)/story-upload.tsx → src/hooks/useHighlights.ts
- `UserProfile()` --calls--> `useFollow()`  [EXTRACTED]
  app/(tabs)/user/[userId].tsx → src/hooks/useFollow.ts

## Communities (25 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (11): CommentRow(), formatTime(), db, colors, spacing, TRENDING_TAGS, { width: SCREEN_WIDTH }, Comment (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (31): dependencies, expo, expo-av, expo-clipboard, expo-constants, expo-document-picker, expo-image-picker, expo-linear-gradient (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (28): backgroundColor, foregroundImage, adaptiveIcon, edgeToEdgeEnabled, package, expo, android, icon (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (10): HighlightPickerModal(), HighlightPickerModalProps, Highlight, useHighlights(), Story, useStories(), apps, firebaseConfig (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (7): LETTERS, DEMO_VIDEOS, useVideoFeed(), useVideoPreloader(), Feed(), { height: SCREEN_HEIGHT, width: SCREEN_WIDTH }, Video

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (6): AUTH_ERRORS, AUTH_ERRORS, EyeIcon(), EyeOffIcon(), IconProps, MboloLogo()

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (7): useFollow(), DEMO_VIDEOS, Tab, { width: SCREEN_WIDTH }, User, UserProfile(), { width: SCREEN_WIDTH }

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (6): CloudinaryResponse, uploadToCloudinary(), StorageProvider, uploadLocal(), UploadResult, uploadVideo()

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (12): devDependencies, @types/react, typescript, main, name, private, scripts, android (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.39
Nodes (6): CommentModal(), CommentRow(), ReplyRow(), formatCount(), formatTime(), useComments()

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): compilerOptions, baseUrl, paths, skipLibCheck, strict, extends, include, @/*

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (5): ANNEES, currentYear, { height: SCREEN_HEIGHT }, JOURS, MOIS

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (6): bundler, fileMetadata, ios, assets, bundle, version

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (3): Language, TranslationKeys, translations

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (3): firestore, indexes, rules

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

## Knowledge Gaps
- **110 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `colors` connect `Community 0` to `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 11`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `db` connect `Community 0` to `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 1` to `Community 8`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _110 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._