import { Platform } from 'react-native'
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { validateEnv, logEnvStatus } from './env'

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
if (apps.length === 0) {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, { persistence: browserLocalPersistence })
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    })
  }
} else {
  auth = getAuth(app)
}

const db: Firestore = getFirestore(app)
const storage: FirebaseStorage = getStorage(app)

export { auth, db, storage }
export default app
