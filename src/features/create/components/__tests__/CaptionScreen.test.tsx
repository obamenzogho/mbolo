/* CaptionScreen.test.tsx — Régression : les hashtags/mentions s'affichent
   colorés (vert) dans l'éditeur de légende via le ghost text overlay. */

import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { CaptionScreen } from '../CaptionScreen'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { colors } from '@/lib/theme'
import { createColors } from '../../theme/createTokens'

/* Évite de charger les dépendances lourdes (typesense, firebase). */
jest.mock('@/services/searchService', () => ({
  searchHashtags: jest.fn(),
  searchUsers: jest.fn(),
}))

/* AsyncStorage (importé par useI18n via @react-native-async-storage). */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

/* RichPostText utilise router.push — mock minimal. */
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}))

/* ComposeAuthorRow tire sur firebase/functions via cloudinary. */
jest.mock('@/lib/cloudinary', () => ({
  getAvatarImageUrl: jest.fn(),
}))

/* Les icônes native nécessitent expo-font/expo-asset — stub léger. */
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native')
  const IconStub = (props: Record<string, unknown>) => <Text {...props} />
  return { Ionicons: IconStub }
})

/* Params par défaut pour rendre CaptionScreen avec un minimal de props. */
const BASE_PROPS = {
  media: [] as SelectedMedia[],
  visibility: 'public' as const,
  commentsEnabled: true,
  onToggleComments: jest.fn(),
  location: null,
  detectingLocation: false,
  onPressVisibility: jest.fn(),
  onPressLocation: jest.fn(),
  userName: 'Tester',
  userPhotoURL: null,
  onAltTextChange: jest.fn(),
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Extrait le style flaté d'un élément React Native pour les assertions. */
function getFlatStyle(element: { props: Record<string, any> }): Record<string, any> {
  return StyleSheet.flatten(element.props.style) as Record<string, any>
}

describe('CaptionScreen ghost text overlay', () => {
  it('affiche le hashtag #voyage en vert avec input transparent', async () => {
    const { getByPlaceholderText, getByText } = await render(
      <CaptionScreen
        {...BASE_PROPS}
        text="#voyage beau"
        onChangeText={jest.fn()}
      />,
    )

    // Le hashtag s'affiche en vert (#00C853) dans le ghost
    const hashtagText = getByText('#voyage')
    expect(getFlatStyle(hashtagText).color).toBe(colors.primary)

    // L'input est en texte transparent
    const input = getByPlaceholderText('Écrire une légende…')
    expect(getFlatStyle(input).color).toBe('transparent')
  })

  it('affiche du texte blanc sans ghost quand le texte est sans token', async () => {
    const { getByPlaceholderText } = await render(
      <CaptionScreen
        {...BASE_PROPS}
        text="bonjour"
        onChangeText={jest.fn()}
      />,
    )

    // L'input affiche du texte blanc (pas transparent)
    const input = getByPlaceholderText('Écrire une légende…')
    expect(getFlatStyle(input).color).toBe(createColors.textPrimary)
  })

  it('affiche la mention @jean en vert avec input transparent', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <CaptionScreen
        {...BASE_PROPS}
        text="Hello @jean"
        onChangeText={jest.fn()}
      />,
    )

    // La mention s'affiche en vert dans le ghost
    const mentionText = getByText('@jean')
    expect(getFlatStyle(mentionText).color).toBe(colors.primary)

    // L'input est en texte transparent
    const input = getByPlaceholderText('Écrire une légende…')
    expect(getFlatStyle(input).color).toBe('transparent')
  })
})
