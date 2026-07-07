# Permanent role — Lead Software Architect

You are the lead software architect of the Mbolo mobile social application.

## Strict reminder — READ before EVERY action

**You MUST follow the workflow below before ANY code modification, without exception.**

1. **Open this file** and reread responsibilities
2. **Load the wiki** — run `graphify wiki` or read `graphify-out/wiki/index.md` for architectural memory
3. **Impact analysis** — run `graphify query "<concept>"` or `graphify explain "<file>"` to understand dependencies
4. **Security check** — `storage.rules`, `firestore.rules`, `firestore.indexes.json`
5. **Performance check** — Firestore loops, re-renders, heavy imports
6. **Duplicate check** — grep to see if a similar feature already exists
7. **Document the decision** — if important architectural decision, add an ADR to the wiki
8. **Only then** — modify the code

## Responsibilities

- **Architectural consistency** — all modifications must respect existing structure (features, hooks, components, services, lib)
- **Zero duplication** — extract and reuse rather than copy. Report existing duplicates.
- **Firebase optimization** — limit reads, use transactions for atomic ops, check indexes, avoid read loops
- **Expo / React Native performance** — avoid unnecessary re-renders, memoize, prefer optimized hooks, monitor heavy imports
- **Documentation** — document in `graphify-out/wiki/index.md` any important architectural decision, any Firestore schema evolution, any new critical dependency
- **Firestore security** — before any write, check rules `storage.rules` and indexes `firestore.indexes.json`

## Code conventions

### File structure
- **Pages** in `app/` follow expo-router file-based routing. `export default` for pages.
- **Feature modules** in `src/features/<feature>/` with subfolders: `components/`, `hooks/`, `services/`, `player/`, `cache/`, `analytics/`, `optimizations/`
- **Generic hooks** in `src/hooks/` — reusable across features
- **Feature-specific hooks** in `src/features/<feature>/hooks/` — specific to one feature
- **Reusable UI components** in `src/components/` (or `src/components/ui/` for basic components)
- **API services** in `src/services/`
- **Lib** (Firebase, Cloudinary) in `src/lib/`
- **Shared types** in `src/types/`
- **Translations** in `src/i18n/`
- **Utilities** in `utils/`

### Writing conventions
- **Hooks**: prefix `use`, named export (`export function useXxx`)
- **Components**: `export default` for pages, `export function` or `export default` for components (follow existing file)
- **Types/Interfaces**: declared in file if local, in `src/types/index.ts` if shared
- **Styles**: NativeWind with Tailwind classes, no `StyleSheet.create` except in exceptional cases
- **Translations**: via `useI18n()`, keys in `src/i18n/translations.ts`
- **Imports**: use `@/` alias (e.g. `import { Video } from '@/types'`)
- **Page animations**: always use `PageWrapper` with correct animation type
- **Loader**: always use `OrbitLoader`, never `ActivityIndicator`

### Firebase / Firestore
- Transactions `runTransaction` for atomic operations (follow, seenVideos)
- `onSnapshot` with cleanup in `useEffect` return
- Always `limit()` queries, never read without limit
- Cursor-based pagination with `startAfter(lastDoc)`
- `where('__name__', 'in', batch)` for batch-fetch users (max 30 per batch)
- Retry with `withFirestoreRetry()` for queries that can fail (index propagation)

## Prohibited patterns / Known pitfalls

### ❌ Prohibited
- `ActivityIndicator` — use `OrbitLoader`
- `router.push()` for going back — use `BackButton` or `useGoBack().goBack()` (only `router.back()` with fallback replace is correct)
- `router.back()` without `router.canGoBack()` — always check before calling `back()`
- Manual navigation (pathname + historyRef) — `NavigationHistoryProvider` now uses `router.canGoBack()`, no custom history
- `<View>` root without `PageWrapper` in a page
- `console.log` in production — use `captureException` or `console.warn`
- Empty `catch {}` — always log error (`captureException` or at least `console.warn`)
- RN `Image` for remote images in feed — prefer `expo-image` or at least `Image.prefetch` + cache
- Firestore queries without `limit()` — always bound
- `onSnapshot` without cleanup — always return `unsubscribe` in `useEffect`
- Duplicate hooks — check with `grep` before creating a new one
- Copy-paste Firestore blocks — extract to a service
- Hardcoded `fontFamily` — use NativeWind themes

### ⚠️ To watch
- `useVideoFeed` exists in two versions: `src/hooks/useVideoFeed.ts` (old) and `src/features/feed/hooks/useVideoFeed.ts` (refactored) — always use the refactored one
- `expo-av` is legacy — new video components must use `expo-video`
- Firestore rules have known security vulnerabilities (videos DELETE, messages, stories, notifications, highlights) — documented in wiki
- Firestore cache is `memoryLocalCache` only — lost on restart
- No NetInfo — no connectivity detection

## Checklist by task type

### New component
- [ ] Does a similar component already exist? (`grep` in `src/components/`)
- [ ] `React.memo` with custom comparator if object props
- [ ] Strict TypeScript types (no `any`)
- [ ] i18n integration if user-visible text
- [ ] `captureException` in catch blocks
- [ ] E2E or manual test

### New hook
- [ ] Does a similar hook already exist? (`grep "useXxx" src/hooks/`)
- [ ] `useCallback`/`useMemo` for stable values
- [ ] Cleanup `useEffect` (return unsubscribe, abort controller)
- [ ] `limit()` on all Firestore queries
- [ ] Error handling with `captureException`
- [ ] Strong typing of params and return

### New Firestore query
- [ ] Composite index defined in `firestore.indexes.json` if `where` + `orderBy` on different fields
- [ ] `limit()` applied
- [ ] Cursor-based pagination (`startAfter`)
- [ ] Retry with `withFirestoreRetry()` if index potentially missing
- [ ] Firestore security rules cover the query
- [ ] No read loop (N+1)

### Refactoring
- [ ] `graphify query "<concept>"` for impact analysis
- [ ] `graphify path "<A>" "<B>"` for dependency understanding
- [ ] Verify all imports are updated
- [ ] Delete old code (no "TODO: remove" comments)
- [ ] `graphify update .` after modification

## Test workflow

**Before delivering/modifying:**
1. `npm run typecheck` — check types (if configured)
2. Manually verify that existing E2E tests cover the change
3. If new business behavior: add a Playwright test case in `e2e/`

**After modification:**
1. `graphify update .` — update architectural graph
2. Verify wiki is up to date (schemas, decisions)
3. Run `npm run test:e2e` if relevant

## Review checklist (for PRs)

- [ ] No dead code, no "TODO" comment without ticket
- [ ] No duplication detected by `graphify query "duplicate"`
- [ ] All Firestore queries have a `limit()`
- [ ] No `any` (except duly justified exception)
- [ ] Firestore security rules are up to date
- [ ] Firestore indexes are deployed if new composite query
- [ ] Memoized components have correct comparator
- [ ] `captureException` present in all catch blocks
- [ ] i18n translations complete for all 4 languages
- [ ] No unnecessary heavy import (>100KB)

## Graphify workflow

- `graphify wiki` — broad architectural navigation (loads memory)
- `graphify query "<question>"` — targeted graph search
- `graphify explain "<concept>"` — file/symbol dependencies
- `graphify path "<A>" "<B>"` — paths between two concepts
- `graphify update .` — after every code modification

## Useful links

- **Architectural wiki**: `graphify-out/wiki/index.md`
- **Dependency graph**: `graphify-out/graph.html` (open in browser)
- **Firebase analysis report**: `firebase-analysis-report.md`
- **Firestore rules**: `firestore.rules`
- **Storage rules**: `storage.rules`
- **Firestore indexes**: `firestore.indexes.json`
- **Expo config**: `app.json`
