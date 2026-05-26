import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

interface QueryErrorMessageProps {
  message: string
  onRetry?: () => void
  variant?: 'banner' | 'fullscreen' | 'toast'
}

const FIRESTORE_INDEX_URL =
  'https://console.firebase.google.com/v1/r/project/mbolo-51177/firestore/indexes'

export default function QueryErrorMessage({
  message,
  onRetry,
  variant = 'banner',
}: QueryErrorMessageProps) {
  const openIndexConsole = () => {
    Linking.openURL(FIRESTORE_INDEX_URL)
  }

  if (variant === 'fullscreen') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(248, 81, 49, 0.15)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <Ionicons name="alert-circle" size={40} color={colors.error} />
        </View>
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Oups, une erreur est survenue
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 24,
            maxWidth: 280,
          }}
        >
          {message}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
              }}
            >
              <Text
                style={{ color: colors.white, fontWeight: '700', fontSize: 14 }}
              >
                Réessayer
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={openIndexConsole}
            style={{
              backgroundColor: colors.surfaceLight,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontWeight: '600',
                fontSize: 14,
              }}
            >
              Créer l'index
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(248, 81, 49, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(248, 81, 49, 0.3)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginHorizontal: 16,
        marginVertical: 8,
        gap: 10,
      }}
    >
      <Ionicons name="warning" size={20} color={colors.error} />
      <Text
        style={{
          color: colors.text,
          fontSize: 13,
          flex: 1,
          lineHeight: 18,
        }}
        numberOfLines={3}
      >
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={{
            backgroundColor: 'rgba(248, 81, 49, 0.2)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Text
            style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}
          >
            Réessayer
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function getIndexErrorMessage(code: string): string {
  if (code === 'failed-precondition') {
    return 'Index Firestore manquant. Les données seront disponibles une fois l\'index créé.'
  }
  if (code === 'permission-denied') {
    return 'Accès refusé. Vérifie tes permissions.'
  }
  if (code === 'unavailable') {
    return 'Service temporairement indisponible. Réessaie dans quelques instants.'
  }
  return 'Une erreur est survenue lors du chargement.'
}
