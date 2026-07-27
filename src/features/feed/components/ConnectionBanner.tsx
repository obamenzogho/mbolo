/* ConnectionBanner — bandeau d'alerte connexion sous la navbar supérieure
   (Ville / Pour toi / Suivi).
   - level 'unstable' : lenteur qui dure → « connexion instable ».
   - level 'offline'  : données mobiles / wifi coupés → message dédié.
   Un OrbitLoader tourne au-dessus du texte pendant l'affichage.
   Fond vert, animation d'entrée/sortie en fondu + glissement. */

import { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import OrbitLoader from '@/components/OrbitLoader'
import { useConnectionStatus } from '../hooks/useConnectionStatus'

// Hauteur approximative de la navbar supérieure (safe area + onglets) sous
// laquelle vient se placer le bandeau.
const HEADER_HEIGHT = 44

export function ConnectionBanner() {
  const insets = useSafeAreaInsets()
  const { level, connectionType } = useConnectionStatus()

  const visible = level === 'unstable' || level === 'offline'
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start()
  }, [visible, anim])

  if (level !== 'unstable' && level !== 'offline') return null

  const message =
    level === 'offline'
      ? (connectionType === 'none' || connectionType == null
          ? 'Aucune connexion : active tes données mobiles ou le Wi-Fi.'
          : 'Pas d’accès à Internet. Vérifie ta connexion.')
      : 'Ta connexion semble instable. Le chargement peut être plus lent.'

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: insets.top + HEADER_HEIGHT,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.loaderWrap}>
        <OrbitLoader size={26} />
      </View>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 12,
    backgroundColor: '#00A86B',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  loaderWrap: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  text: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '600', lineHeight: 17 },
})
