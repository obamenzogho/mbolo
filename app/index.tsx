import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../src/lib/firebase'
import SplashScreen from '../src/components/SplashScreen'

export default function Index() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      setSignedIn(Boolean(user))
      setReady(true)
    })
    return unsubscribe
  }, [])

  if (!ready) {
    return <SplashScreen />
  }

  return <Redirect href={signedIn ? '/(tabs)/feed' : '/(auth)/login'} />
}
