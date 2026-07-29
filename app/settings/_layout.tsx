import { Stack } from 'expo-router'
import { colors } from '@/lib/theme'
import { slideRight } from '@/navigation/transitions'

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        ...slideRight,
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  )
}
