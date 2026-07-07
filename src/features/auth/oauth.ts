import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import {
  GoogleAuthProvider, OAuthProvider, signInWithCredential, type User as FbUser,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { captureException } from '../../lib/sentry'
import { useStartupStore } from '../startup/store/startupStore'
import type { User } from '../../types'

WebBrowser.maybeCompleteAuthSession()

async function generateUniquePseudo(base: string): Promise<string> {
  const clean = (base || 'user').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user'
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? clean : `${clean}${Math.floor(Math.random() * 99999)}`
    const taken = await getDoc(doc(db, 'usernames', candidate))
    if (!taken.exists()) return candidate
  }
  return `${clean}${Date.now().toString().slice(-6)}`
}

async function ensureUserDoc(user: FbUser, displayName?: string | null) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    const pseudo = await generateUniquePseudo(displayName || user.email?.split('@')[0] || 'user')
    const profile = {
      email: user.email ?? '',
      pseudo,
      pseudoLower: pseudo.toLowerCase(),
      nom: displayName ?? '',
      photoURL: user.photoURL ?? '',
      bio: '',
      followers: [], following: [],
      followerCount: 0, followingCount: 0,
      postsCount: 0, totalLikes: 0,
      privateAccount: false, notifications: true,
      createdAt: serverTimestamp(),
    }
    await setDoc(ref, profile)
    await setDoc(doc(db, 'usernames', pseudo.toLowerCase()), { email: user.email ?? '', uid: user.uid })
    useStartupStore.getState().setUser({ id: user.uid, ...profile } as unknown as User)
    return
  }

  useStartupStore.getState().setUser({ id: user.uid, ...snap.data() } as User)
}

export async function isAppleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync())
}

export async function signInWithApple(): Promise<FbUser | null> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
    if (!cred.identityToken) throw new Error('Apple: identityToken manquant')

    const provider = new OAuthProvider('apple.com')
    const credential = provider.credential({ idToken: cred.identityToken })
    const { user } = await signInWithCredential(auth, credential)

    const appleName = cred.fullName
      ? `${cred.fullName.givenName ?? ''} ${cred.fullName.familyName ?? ''}`.trim()
      : null

    await ensureUserDoc(user, appleName || user.displayName)
    return user
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return null
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'signInWithApple' })
    throw e
  }
}

export function useGoogleAuth() {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  })

  const signInWithGoogle = async (): Promise<FbUser | null> => {
    try {
      const res = await promptAsync()
      if (res?.type !== 'success') return null
      const idToken = res.params?.id_token
      if (!idToken) throw new Error('Google: id_token manquant')

      const credential = GoogleAuthProvider.credential(idToken)
      const { user } = await signInWithCredential(auth, credential)
      await ensureUserDoc(user, user.displayName)
      return user
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'signInWithGoogle' })
      throw e
    }
  }

  return { ready: !!request, signInWithGoogle }
}
