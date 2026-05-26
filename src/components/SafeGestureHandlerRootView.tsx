import { PropsWithChildren } from 'react'
import { ViewStyle } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

type Props = PropsWithChildren<{ style?: ViewStyle }>

/**
 * Wrapper simplifié autour de GestureHandlerRootView.
 * L'ancienne version importait GestureHandlerRootViewContext depuis un chemin
 * interne CommonJS, ce qui causait un mismatch de contexte avec Metro (ESM vs CJS)
 * et faisait que GestureDetector ne reconnaissait pas le provider parent.
 * La solution correcte est de laisser GestureHandlerRootView gérer son propre contexte.
 */
export default function SafeGestureHandlerRootView({ children, style }: Props) {
  return (
    <GestureHandlerRootView style={style}>
      {children}
    </GestureHandlerRootView>
  )
}
