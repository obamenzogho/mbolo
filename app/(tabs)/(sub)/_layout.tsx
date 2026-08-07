import { Stack } from 'expo-router'
import { slideRight, slideRightEdgeOnly, slideUpFast } from '@/navigation/transitions'
import { colors } from '@/lib/theme'

export default function SubStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        ...slideRight,
      }}
    >
      <Stack.Screen name="upload" options={slideUpFast} />
      <Stack.Screen name="reel-upload" options={slideUpFast} />
      <Stack.Screen name="edit-profile" options={slideRight} />
      <Stack.Screen name="discover" options={slideRight} />
      <Stack.Screen name="explore" options={slideRightEdgeOnly} />
      <Stack.Screen name="messages/conversation/[id]" options={slideRight} />
      <Stack.Screen name="notifications/follow-requests" options={slideRight} />
    </Stack>
  )
}
