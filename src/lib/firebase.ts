import { Platform } from 'react-native'
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  getReactNativePersistence,
  Auth,
} from 'firebase/auth'
import { type Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'
import { getFunctions, Functions } from 'firebase/functions'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { validateEnv, logEnvStatus } from './env'
import { captureException } from './sentry'

const env = validateEnv()
if (!env.valid) {
  console.warn('[Mbolo] Configuration incomplète. Variables manquantes:', env.missing.join(', '))
}
if (env.warnings.length > 0) {
  env.warnings.forEach(w => console.warn('[Mbolo]', w))
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

const apps = getApps()
const app: FirebaseApp = apps.length > 0 ? getApp() : initializeApp(firebaseConfig)

let auth: Auth
try {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, { persistence: browserLocalPersistence })
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    })
  }
} catch (error: any) {
  if (error?.code && error.code !== 'auth/already-initialized') {
    console.warn('[Mbolo] Firebase Auth persistence init failed:', error.message || error)
  }
  auth = getAuth(app)
}

function initFirestore(app: FirebaseApp): Firestore {
  try {
    const { initializeFirestore, memoryLocalCache } = require('firebase/firestore')
    const localCache = memoryLocalCache()
    return initializeFirestore(app, { localCache })
  } catch {
    try {
      const { getFirestore } = require('firebase/firestore')
      return getFirestore(app)
    } catch (e2) {
      captureException(e2 instanceof Error ? e2 : new Error(String(e2)), { context: 'initFirestore' })
      console.warn('[Firestore] init fallback failed:', e2)
      const firestore = require('firebase/firestore')
      return firestore.getFirestore ? firestore.getFirestore(app) : firestore.initializeFirestore(app, {})
    }
  }
}

const db = initFirestore(app)
const storage: FirebaseStorage = getStorage(app)
const functions: Functions = getFunctions(app)

export { auth, db, storage, functions }
export default app
