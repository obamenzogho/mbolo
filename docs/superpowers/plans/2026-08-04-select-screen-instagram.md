# SelectScreen Instagram-Level Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform SelectScreen into an Instagram-style full-screen gallery picker with compact header, album dropdown, and dual selection modes.

**Architecture:** Refactor in-place — SelectScreen gets a new compact header (album name + mode icons + multi-select toggle), GalleryGrid becomes full-screen with single/multi selection modes. No new files, minimal state additions.

**Tech Stack:** React Native, Expo Image, expo-media-library, Ionicons, StyleSheet

## Global Constraints

- Follow AGENTS.md quality standards (no magic values, i18n via `useI18n()`, typed payloads)
- Use `createColors` / `createType` tokens from `createTokens.ts`
- Use `@/` import alias
- Accessibility: `accessibilityRole`, `accessibilityLabel`, `accessibilityState` on all interactive elements
- No `any` types, strict TypeScript

---

### Task 1: GalleryGrid — Add selectionMode prop and single-select behavior

**Files:**
- Modify: `src/features/create/components/GalleryGrid.tsx:32-38,54,212-224,308-352`

**Interfaces:**
- Consumes: `GalleryAsset` from `@/hooks/useGallery`
- Produces: `selectionMode` and `onSelectImmediate` props on GalleryGrid

- [ ] **Step 1: Update GalleryGridProps interface**

Add `selectionMode` and `onSelectImmediate` props:

```typescript
interface GalleryGridProps {
  selectedUris: string[]
  onToggle: (asset: GalleryAsset) => void
  selectionMode?: 'single' | 'multi'
  onSelectImmediate?: (asset: GalleryAsset) => void
  selectionOrder?: Map<string, number>
}
```

- [ ] **Step 2: Update GridCell to accept and use selectionMode**

Modify `GridCell` to conditionally render overlay/badge only in multi mode:

```typescript
const GridCell = memo(function GridCell({
  item,
  size,
  selected,
  selectionIndex,
  selectionMode,
  onToggle,
  onSelectImmediate,
}: {
  item: GalleryAsset
  size: number
  selected: boolean
  selectionIndex?: number
  selectionMode: 'single' | 'multi'
  onToggle: (asset: GalleryAsset) => void
  onSelectImmediate?: (asset: GalleryAsset) => void
}) {
  const handlePress = useCallback(() => {
    if (selectionMode === 'single' && onSelectImmediate) {
      onSelectImmediate(item)
    } else {
      onToggle(item)
    }
  }, [selectionMode, item, onToggle, onSelectImmediate])

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={item.filename}
      style={[styles.cell, { width: size, height: size }]}
    >
      <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" transition={100} />

      {item.mediaType === 'video' && item.duration ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      ) : null}

      {selectionMode === 'multi' && selected ? <View style={styles.selectedOverlay} /> : null}
      {selectionMode === 'multi' && selected ? (
        <View style={styles.badge}>
          {selectionIndex !== undefined ? (
            <Text style={styles.badgeNumber}>{selectionIndex}</Text>
          ) : (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </View>
      ) : null}
    </Pressable>
  )
})
```

- [ ] **Step 3: Update renderItem to pass new props**

Modify `renderItem` callback in `GalleryGridComponent`:

```typescript
const renderItem = useCallback(
  ({ item }: { item: GalleryAsset }) => (
    <GridCell
      item={item}
      size={cellSize}
      selected={selectedUris.includes(item.uri)}
      selectionIndex={selectionOrder?.get(item.uri)}
      selectionMode={selectionMode}
      onToggle={onToggle}
      onSelectImmediate={onSelectImmediate}
    />
  ),
  [selectedUris, selectionOrder, onToggle, cellSize, selectionMode, onSelectImmediate],
)
```

- [ ] **Step 4: Destructure new props in GalleryGridComponent**

```typescript
function GalleryGridComponent({
  selectedUris,
  onToggle,
  selectionMode = 'single',
  onSelectImmediate,
  selectionOrder,
}: GalleryGridProps) {
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep GalleryGrid`
Expected: No errors in GalleryGrid.tsx

- [ ] **Step 6: Commit**

```bash
git add src/features/create/components/GalleryGrid.tsx
git commit -m "feat(create): GalleryGrid — add selectionMode and onSelectImmediate props"
```

---

### Task 2: GalleryGrid — Remove AlbumPickerButton from render

**Files:**
- Modify: `src/features/create/components/GalleryGrid.tsx:272-305`

**Interfaces:**
- Consumes: AlbumPickerList stays, AlbumPickerButton removed from render
- Produces: GalleryGrid no longer renders AlbumPickerButton

- [ ] **Step 1: Remove AlbumPickerButton from render**

In the return statement, remove the `AlbumPickerButton` component (it will be rendered by SelectScreen header instead):

```tsx
return (
  <View style={styles.root}>
    {/* AlbumPickerButton REMOVED — now in SelectScreen header */}

    <FlatList
      data={assets}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      initialNumToRender={12}
      windowSize={5}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.news.compose.galleryEmpty}</Text>
          </View>
        )
      }
    />

    {pickerOpen ? (
      <AlbumPickerList albums={albums} currentId={albumId} onSelect={handleSelectAlbum} />
    ) : null}
  </View>
)
```

- [ ] **Step 2: Add selectedUris check for single-mode visual feedback**

For single mode, add a subtle checkmark overlay (not the numbered badge) to show which asset was just tapped:

Update `GridCell` styles to include a `singleSelected` state:

```typescript
{selectionMode === 'single' && selected ? (
  <View style={styles.singleSelectedOverlay} />
) : null}
```

Add style:

```typescript
singleSelectedOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(255,255,255,0.15)',
},
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep GalleryGrid`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/create/components/GalleryGrid.tsx
git commit -m "feat(create): GalleryGrid — remove AlbumPickerButton from render, add single-mode overlay"
```

---

### Task 3: SelectScreen — Build Instagram-style header

**Files:**
- Modify: `src/features/create/components/SelectScreen.tsx:37-98,261-363`

**Interfaces:**
- Consumes: `AlbumPickerButton`, `AlbumOption` from `./AlbumPicker`
- Produces: Header with album dropdown, mode icons, multi-select toggle

- [ ] **Step 1: Add selectionMode state and album title lookup**

Add state and import `AlbumPickerButton`:

```typescript
const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single')
const [albums, setAlbums] = useState<AlbumOption[]>([])
const [albumId, setAlbumId] = useState<string | null>(null)
const [pickerOpen, setPickerOpen] = useState(false)
```

Import:

```typescript
import { AlbumPickerButton, AlbumPickerList, type AlbumOption } from './AlbumPicker'
```

- [ ] **Step 2: Build the Instagram-style header component**

Create a `GalleryHeader` component inside SelectScreen.tsx:

```typescript
function GalleryHeader({
  albumLabel,
  pickerOpen,
  onTogglePicker,
  selectionMode,
  onToggleMode,
  onCamera,
  onText,
}: {
  albumLabel: string
  pickerOpen: boolean
  onTogglePicker: () => void
  selectionMode: 'single' | 'multi'
  onToggleMode: () => void
  onCamera: () => void
  onText: () => void
}) {
  return (
    <View style={styles.galleryHeader}>
      {/* Left: Album picker */}
      <Pressable
        onPress={onTogglePicker}
        accessibilityRole="button"
        accessibilityState={{ expanded: pickerOpen }}
        style={styles.albumTrigger}
      >
        <Text numberOfLines={1} style={styles.albumLabel}>
          {albumLabel}
        </Text>
        <Ionicons
          name={pickerOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={createColors.textPrimary}
        />
      </Pressable>

      {/* Center: Mode icons */}
      <View style={styles.headerModes}>
        <Pressable
          onPress={onCamera}
          accessibilityRole="button"
          accessibilityLabel="Caméra"
          style={({ pressed }) => [styles.headerModeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="camera-outline" size={22} color={createColors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={onText}
          accessibilityRole="button"
          accessibilityLabel="Texte"
          style={({ pressed }) => [styles.headerModeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="text" size={22} color={createColors.textPrimary} />
        </Pressable>
      </View>

      {/* Right: Multi-select toggle */}
      <Pressable
        onPress={onToggleMode}
        accessibilityRole="button"
        accessibilityState={{ selected: selectionMode === 'multi' }}
        accessibilityLabel="Sélection multiple"
        style={({ pressed }) => [styles.headerMultiBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons
          name="copy-outline"
          size={20}
          color={selectionMode === 'multi' ? createColors.textPrimary : createColors.textSecondary}
        />
      </Pressable>
    </View>
  )
}
```

- [ ] **Step 3: Add header styles**

```typescript
galleryHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  height: 44,
  backgroundColor: createColors.canvas,
},
albumTrigger: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  maxWidth: '50%',
},
albumLabel: {
  color: createColors.textPrimary,
  fontSize: 16,
  fontWeight: '700',
},
headerModes: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,
},
headerModeBtn: {
  width: 36,
  height: 36,
  alignItems: 'center',
  justifyContent: 'center',
},
headerMultiBtn: {
  width: 36,
  height: 36,
  alignItems: 'center',
  justifyContent: 'center',
},
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep SelectScreen`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/features/create/components/SelectScreen.tsx
git commit -m "feat(create): SelectScreen — add Instagram-style GalleryHeader"
```

---

### Task 4: SelectScreen — Replace old layout with full-screen grid

**Files:**
- Modify: `src/features/create/components/SelectScreen.tsx:97-225`

**Interfaces:**
- Consumes: GalleryHeader (Task 3), GalleryGrid with selectionMode (Tasks 1-2)
- Produces: Full-screen grid layout with header

- [ ] **Step 1: Remove old preview/carousel header and createBar**

Delete the entire `header` variable (lines 97-205) and the `CreateTypeButton` component (lines 227-259).

- [ ] **Step 2: Rewrite SelectScreenComponent return statement**

```typescript
function SelectScreenComponent({
  media,
  mode,
  onModeChange,
  onSelectAsset,
  onCapture,
  onPickText,
}: SelectScreenProps) {
  const { t } = useI18n()
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single')
  const [albums, setAlbums] = useState<AlbumOption[]>([])
  const [albumId, setAlbumId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const allLabel = t.news.compose.galleryAlbumAll
  const currentAlbum = albums.find((a) => a.id === albumId)
  const albumLabel = currentAlbum?.title ?? allLabel

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => (prev === 'single' ? 'multi' : 'single'))
  }, [])

  const handleTogglePicker = useCallback(() => setPickerOpen((v) => !v), [])

  const handleSelectAlbum = useCallback((id: string | null) => {
    setPickerOpen(false)
    setAlbumId(id)
  }, [])

  const handleSelectImmediate = useCallback((asset: GalleryAsset) => {
    onSelectAsset(asset, false)
  }, [onSelectAsset])

  const handleToggleAsset = useCallback((asset: GalleryAsset) => {
    onSelectAsset(asset, true)
  }, [onSelectAsset])

  if (mode === 'camera') {
    return (
      <View style={styles.screen}>
        <GalleryHeader
          albumLabel={albumLabel}
          pickerOpen={pickerOpen}
          onTogglePicker={handleTogglePicker}
          selectionMode={selectionMode}
          onToggleMode={toggleSelectionMode}
          onCamera={() => onModeChange('camera')}
          onText={onPickText}
        />
        <ComposeCamera onCapture={onCapture} />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <GalleryHeader
        albumLabel={albumLabel}
        pickerOpen={pickerOpen}
        onTogglePicker={handleTogglePicker}
        selectionMode={selectionMode}
        onToggleMode={toggleSelectionMode}
        onCamera={() => onModeChange('camera')}
        onText={onPickText}
      />
      <GalleryGrid
        selectedUris={media.map((m) => m.uri)}
        selectionMode={selectionMode}
        onSelectImmediate={handleSelectImmediate}
        onToggle={handleToggleAsset}
        selectionOrder={selectionMode === 'multi' ? undefined : undefined}
      />
    </View>
  )
}
```

- [ ] **Step 3: Update selectionOrder for multi mode**

In multi mode, pass the selection order map:

```typescript
const selectionOrder = useMemo(() => {
  if (selectionMode !== 'multi') return undefined
  const map = new Map<string, number>()
  media.forEach((m, idx) => map.set(m.uri, idx + 1))
  return map
}, [media, selectionMode])
```

Pass to GalleryGrid:

```typescript
<GalleryGrid
  selectedUris={media.map((m) => m.uri)}
  selectionMode={selectionMode}
  onSelectImmediate={handleSelectImmediate}
  onToggle={handleToggleAsset}
  selectionOrder={selectionOrder}
/>
```

- [ ] **Step 4: Remove unused state and imports**

Remove: `focusedIndex`, `previewLoading`, `multipleSelectionEnabled`, `THUMB_SIZE`, `THUMB_GAP`, `OrbitLoader`, `useVideoFrame`, `CREATE_MAX_MEDIA` (if only used in deleted code).

Remove unused imports: `ScrollView`, `useMemo`, `useEffect` (if no longer needed).

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep SelectScreen`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/features/create/components/SelectScreen.tsx
git commit -m "feat(create): SelectScreen — replace old layout with full-screen Instagram grid"
```

---

### Task 5: Wire up album loading in SelectScreen

**Files:**
- Modify: `src/features/create/components/SelectScreen.tsx`

**Interfaces:**
- Consumes: `MediaLibrary` from `expo-media-library`
- Produces: Albums loaded and passed to GalleryGrid/GalleryHeader

- [ ] **Step 1: Add album loading useEffect**

```typescript
useEffect(() => {
  let alive = true
  MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
    .then((found) => {
      if (!alive) return
      const allLabel = t.news.compose.galleryAlbumAll
      const mapped: AlbumOption[] = [
        { id: null, title: allLabel, assetCount: 0 },
        ...found
          .filter((a) => a.assetCount > 0)
          .map((a) => ({ id: a.id, title: a.title, assetCount: a.assetCount })),
      ]
      setAlbums(mapped)
    })
    .catch(() => {})
  return () => { alive = false }
}, [])
```

- [ ] **Step 2: Pass albumId to GalleryGrid**

GalleryGrid needs `albumId` to filter assets. Add it as a prop:

```typescript
// In GalleryGridProps:
albumId?: string | null
```

Pass from SelectScreen:

```typescript
<GalleryGrid
  selectedUris={media.map((m) => m.uri)}
  selectionMode={selectionMode}
  onSelectImmediate={handleSelectImmediate}
  onToggle={handleToggleAsset}
  selectionOrder={selectionOrder}
  albumId={albumId}
/>
```

- [ ] **Step 3: Update GalleryGrid to use albumId prop**

In GalleryGrid, add `albumId` to props and use it in `loadAssets`:

```typescript
interface GalleryGridProps {
  selectedUris: string[]
  onToggle: (asset: GalleryAsset) => void
  selectionMode?: 'single' | 'multi'
  onSelectImmediate?: (asset: GalleryAsset) => void
  selectionOrder?: Map<string, number>
  albumId?: string | null
}
```

Update `loadAssets` to use the prop:

```typescript
const loadAssets = useCallback(
  async (reset = false) => {
    if (!granted) return
    if (!reset && loadingRef.current) return
    if (!reset && !hasMoreRef.current) return

    const token = reset ? ++requestRef.current : requestRef.current
    loadingRef.current = true
    setLoading(true)
    try {
      const options: MediaLibrary.AssetsOptions = {
        first: PAGE_SIZE,
        sortBy: [MediaLibrary.SortBy.creationTime],
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      }
      if (albumId) {
        options.album = albumId
      }
      if (!reset && cursorRef.current) {
        options.after = cursorRef.current
      }
      // ... rest unchanged
    }
  },
  [granted, albumId],
)
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "GalleryGrid|SelectScreen"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/features/create/components/SelectScreen.tsx src/features/create/components/GalleryGrid.tsx
git commit -m "feat(create): wire album loading from SelectScreen to GalleryGrid"
```

---

### Task 6: Clean up old styles and remove dead code

**Files:**
- Modify: `src/features/create/components/SelectScreen.tsx:261-363`

**Interfaces:**
- Consumes: None
- Produces: Clean stylesheet with no unused styles

- [ ] **Step 1: Remove old styles**

Delete these unused styles from SelectScreen:
- `previewWrap`, `preview`, `previewMedia`, `previewEmpty`, `emptyText`
- `carouselWrap`, `carouselContent`, `thumb`, `thumbFocused`, `thumbImage`, `videoBadge`
- `multipleButton`, `multipleButtonActive`, `multipleButtonText`, `multipleButtonTextActive`
- `createBar`, `createType`, `createTypePressed`, `createTypeCircle`, `createTypeCircleActive`, `createTypeLabel`
- `loaderOverlay`

- [ ] **Step 2: Verify no remaining references**

Run: `grep -n "previewWrap\|carouselWrap\|createBar\|loaderOverlay\|THUMB_SIZE" src/features/create/components/SelectScreen.tsx`
Expected: No matches

- [ ] **Step 3: Run typecheck and tests**

Run: `npx tsc --noEmit 2>&1 | grep SelectScreen && npx jest src/features/create --passWithNoTests 2>&1 | tail -5`
Expected: No errors, tests pass

- [ ] **Step 4: Commit**

```bash
git add src/features/create/components/SelectScreen.tsx
git commit -m "chore(create): remove dead styles and code from SelectScreen"
```

---

### Task 7: Integration test — verify SelectScreen renders correctly

**Files:**
- Create: `src/features/create/components/__tests__/SelectScreen.test.tsx`

**Interfaces:**
- Consumes: SelectScreen component, all props
- Produces: Test coverage for header + grid rendering

- [ ] **Step 1: Write test file**

```typescript
/* SelectScreen.test.tsx — Regression: Instagram-style SelectScreen renders
   header with album picker, mode icons, and full-screen grid. */

import { render } from '@testing-library/react-native'
import { SelectScreen } from '../SelectScreen'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      news: {
        compose: {
          galleryAlbumAll: 'Récents',
          galleryAlbums: 'Albums',
          galleryPermission: 'Accès à la pellicule requis',
          galleryAllow: 'Autoriser',
          gallerySettings: 'Réglages',
          galleryError: 'Erreur de chargement',
          galleryRetry: 'Réessayer',
          galleryEmpty: 'Aucun média',
          placeholder: 'Sélectionnez un média',
          modeGallery: 'Galerie',
          modeCamera: 'Caméra',
          modeText: 'Texte',
          multipleSelection: 'Sélection multiple',
          a11yMultipleSelection: 'Activer la sélection multiple',
        },
      },
    },
  }),
}))

jest.mock('expo-media-library', () => ({
  usePermissions: () => [{ status: 'granted', canAskAgain: true }, jest.fn()],
  getAssetsAsync: jest.fn().mockResolvedValue({ assets: [], endCursor: null, hasNextPage: false }),
  getAlbumsAsync: jest.fn().mockResolvedValue([]),
  SortBy: { creationTime: 'creationTime' },
  MediaType: { photo: 'photo', video: 'video' },
}))

jest.mock('@/features/news/components/compose/ComposeCamera', () => ({
  ComposeCamera: () => null,
}))

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native')
  const IconStub = (props: Record<string, unknown>) => <Text {...props} />
  return { Ionicons: IconStub }
})

jest.mock('expo-image', () => {
  const { Image } = require('react-native')
  return { Image }
})

const BASE_PROPS = {
  media: [] as SelectedMedia[],
  mode: 'gallery' as const,
  onModeChange: jest.fn(),
  onSelectAsset: jest.fn(),
  onCapture: jest.fn(),
  onPickText: jest.fn(),
}

describe('SelectScreen Instagram layout', () => {
  it('renders header with album label', () => {
    const { getByText } = render(<SelectScreen {...BASE_PROPS} />)
    expect(getByText('Récents')).toBeTruthy()
  })

  it('renders camera and text mode icons', () => {
    const { getByText } = render(<SelectScreen {...BASE_PROPS} />)
    expect(getByText('camera-outline')).toBeTruthy()
    expect(getByText('text')).toBeTruthy()
  })

  it('renders multi-select toggle', () => {
    const { getByText } = render(<SelectScreen {...BASE_PROPS} />)
    expect(getByText('copy-outline')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/features/create/components/__tests__/SelectScreen.test.tsx 2>&1 | tail -15`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/features/create/components/__tests__/SelectScreen.test.tsx
git commit -m "test(create): add SelectScreen Instagram layout regression tests"
```

---

### Task 8: Final integration verification

**Files:**
- Verify: `app/create.tsx` (no changes needed — onSelectAsset signature unchanged)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working integration

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: No new errors

- [ ] **Step 2: Run all create tests**

Run: `npx jest src/features/create --passWithNoTests 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 3: Verify app/create.tsx compatibility**

The parent (`app/create.tsx`) calls `onSelectAsset(asset, multiple)` which is unchanged. The `handleRightPress` function still navigates from select → edit → caption. No changes needed.

Run: `grep -n "handleSelectAsset\|onSelectAsset" app/create.tsx | head -5`
Expected: Signature unchanged

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "feat(create): SelectScreen Instagram-level redesign complete

- Full-screen 3-column grid (no preview/carousel)
- Instagram-style header: album dropdown + camera/text icons + multi-select toggle
- Single-select mode (tap → next) and multi-select mode (badges)
- Album picker integrated in header
- All old styles and dead code removed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
