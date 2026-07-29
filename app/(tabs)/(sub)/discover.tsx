import { useEffect } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import PageWrapper from '@/components/PageWrapper'
import { colors } from '@/lib/theme'
import OrbitLoader from '@/components/OrbitLoader'

export default function Discover() {
  useEffect(() => {
    router.replace('/explore')
  }, [])

  return (
    <PageWrapper type="stack" swipeBack backTo="/(tabs)/profile">
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <OrbitLoader />
      </View>
    </PageWrapper>
  )
}
