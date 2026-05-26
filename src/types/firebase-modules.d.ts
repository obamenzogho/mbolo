// Firebase ships types through package exports that are not resolved correctly
// in this Expo setup. These ambient declarations keep strict project checks
// focused on app code until the Firebase package resolution is normalized.
declare module 'firebase/app' {
  export type FirebaseApp = any
  export const initializeApp: any
  export const getApps: any
  export const getApp: any
}

declare module 'firebase/auth' {
  export type Auth = any
  export const initializeAuth: any
  export const getAuth: any
  export const browserLocalPersistence: any
  export const onAuthStateChanged: any
  export const signInWithEmailAndPassword: any
  export const createUserWithEmailAndPassword: any
  export const signOut: any
  export const updateProfile: any
}

declare module 'firebase/firestore' {
  export type Firestore = any
  export type DocumentData = any
  export type QueryDocumentSnapshot<T = any> = any
  export const getFirestore: any
  export const collection: any
  export const query: any
  export const where: any
  export const orderBy: any
  export const limit: any
  export const startAfter: any
  export const getDocs: any
  export const getDoc: (docRef: any) => Promise<any>
  export const doc: any
  export const setDoc: any
  export const addDoc: any
  export const updateDoc: any
  export const deleteDoc: any
  export const onSnapshot: any
  export const serverTimestamp: any
  export const increment: any
  export const arrayUnion: any
  export const arrayRemove: any
  export const runTransaction: (db: any, updateFn: (transaction: any) => Promise<any>) => Promise<any>
}

declare module 'firebase/storage' {
  export type FirebaseStorage = any
  export const getStorage: any
  export const ref: any
  export const uploadBytesResumable: any
  export const uploadBytes: any
  export const getDownloadURL: any
  export const deleteObject: any
}

declare module 'expo-modules-core' {
  export class EventSubscription {
    remove(): void
  }
  export class NativeModule<T = any> {
    [key: string]: any
  }
  export class UnavailabilityError extends Error {
    constructor(moduleName: string, propertyName: string)
  }
  export const requireOptionalNativeModule: any
  export const uuid: any
  const ExpoModulesCore: any
  export default ExpoModulesCore
}
