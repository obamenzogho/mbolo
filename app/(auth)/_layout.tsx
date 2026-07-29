import { Stack } from 'expo-router'
import { slideRight } from '@/navigation/transitions'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ ...slideRight, headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
