# Plan : rendre le modal de commentaires dans FeedScreen

## Motivation
FullWindowOverlay pose des soucis sur iOS Expo Go. La solution la plus fiable : rendre le composant `RootCommentModal` directement dans `FeedScreen` (même arbre React, même UIViewController natif). Pas de `FullWindowOverlay`, pas de `Modal`, pas de problème de couche iOS.

## Fichier 1 : `src/contexts/CommentModalContext.tsx`

### 1. Restaurer KeyboardAvoidingView dans les imports
```tsx
import { View, Text, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Dimensions, Keyboard } from 'react-native'
```

### 2. Garder l'interface mais ajouter `commentOptions`
```tsx
interface CommentModalContextValue {
  openCommentModal: (options: CommentOptions) => void
  closeCommentModal: () => void
  commentOptions: CommentOptions | null
}
```

### 3. Exporter RootCommentModal
Ajouter `export` :
```tsx
export function RootCommentModal(...) {
```

### 4. Supprimer le kbHeight et son useEffect
Supprimer :
```tsx
const [kbHeight, setKbHeight] = useState(0)

useEffect(() => {
  if (Platform.OS !== 'ios') return
  const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height))
  const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0))
  return () => { show.remove(); hide.remove() }
}, [])
```

### 5. Restaurer KeyboardAvoidingView
Remplacer :
```tsx
<View style={{ flex: 1, paddingBottom: kbHeight }}>
```
par :
```tsx
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
```
Et remplacer `</View>` (fermeture du pbHeight View) par `</KeyboardAvoidingView>`.

### 6. Simplifier CommentModalProvider
Remplacer tout le return par :
```tsx
  const value = useMemo(() => ({ openCommentModal, closeCommentModal, commentOptions: options }), [openCommentModal, closeCommentModal, options])

  return (
    <CommentModalContext.Provider value={value}>
      {children}
    </CommentModalContext.Provider>
  )
```

## Fichier 2 : `src/features/feed/FeedScreen.tsx`

### 1. Ajouter l'import
Après la ligne `import { useCommentModal } from '../../contexts/CommentModalContext'` :
```tsx
import { RootCommentModal } from '../../contexts/CommentModalContext'
```

### 2. Lire commentOptions du contexte
Remplacer :
```tsx
const { openCommentModal } = useCommentModal()
```
par :
```tsx
const { openCommentModal, commentOptions, closeCommentModal } = useCommentModal()
```

### 3. Ajouter le rendu du modal dans le JSX
Juste avant `</View>` de fermeture du `return` principal (ligne 306), ajouter :
```tsx
{commentOptions && (
  <View style={[StyleSheet.absoluteFill, { zIndex: 10000 }]}>
    <RootCommentModal
      videoId={commentOptions.videoId}
      videoOwnerId={commentOptions.videoOwnerId}
      isOwner={commentOptions.isOwner}
      onClose={closeCommentModal}
    />
  </View>
)}
```
