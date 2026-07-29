import { useNavigationState, useRoute } from '@react-navigation/native'

/**
 * `true` si l'écran est le premier de son navigateur (index 0 de la Stack).
 * Dans ce cas le native-stack n'a rien à popper : ni animation de push,
 * ni geste de retour natif. Le fallback JS doit prendre le relais.
 */
export function useIsStackEntry(): boolean {
  const route = useRoute()
  return useNavigationState((state) => state?.routes?.[0]?.key === route.key) ?? false
}
