import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { MboloLogo, EyeIcon, EyeOffIcon } from '../../src/components/Icons'
import { router } from 'expo-router'

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'Email invalide',
  'auth/user-disabled': 'Ce compte a été désactivé',
  'auth/user-not-found': 'Email ou nom d\'utilisateur incorrect',
  'auth/wrong-password': 'Mot de passe incorrect',
  'auth/invalid-credential': 'Email ou nom d\'utilisateur incorrect',
  'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard',
  'auth/network-request-failed': 'Erreur réseau. Vérifie ta connexion',
}

function getFirebaseError(code: string): string {
  return AUTH_ERRORS[code] || 'Une erreur est survenue. Réessaie.'
}

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const inputBase = {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  }

  const resolveEmail = async (input: string): Promise<string> => {
    const value = input.trim().toLowerCase()
    if (input.includes('@')) return value

    // 1. Tenter via la collection usernames
    try {
      const usernameDoc = await getDoc(doc(db, 'usernames', value))
      if (usernameDoc.exists()) {
        return usernameDoc.data().email
      }
    } catch (_) {
      // silencieux — on tente la méthode suivante
    }

    // 2. Fallback : requête users
    const q = query(
      collection(db, 'users'),
      where('pseudo', '==', value),
      limit(1)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      throw { code: 'auth/user-not-found' }
    }
    return snapshot.docs[0].data().email
  }

  const handleLogin = async () => {
    Keyboard.dismiss()
    if (!identifier || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs')
      return
    }
    setLoading(true)
    try {
      const email = await resolveEmail(identifier)
      await signInWithEmailAndPassword(auth, email, password)
      router.replace('/(tabs)/feed')
    } catch (error: any) {
      Alert.alert('Erreur', getFirebaseError(error.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={Keyboard.dismiss}
            style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}
          >
            {/* Logo */}
            <View style={{ alignItems: 'center', marginBottom: 48 }}>
              <MboloLogo size={88} />
              <Text
                style={{
                  fontSize: 15, color: colors.textSecondary, marginTop: 20,
                  letterSpacing: 0.5, textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                Connecte-toi et partage{'\n'}ce qui te passionne avec le monde
              </Text>
            </View>

            {/* Email ou nom d'utilisateur */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>
                Email ou nom d'utilisateur
              </Text>
              <View
                style={[
                  inputBase,
                  {
                    borderColor: focusedField === 'identifier' ? colors.primary : colors.border,
                    flexDirection: 'row', alignItems: 'center',
                  },
                ]}
              >
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="ton@email.com ou @utilisateur"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setFocusedField('identifier')}
                  onBlur={() => setFocusedField(null)}
                  style={{ flex: 1, color: colors.text, fontSize: 16 }}
                />
              </View>
            </View>

            {/* Mot de passe */}
            <View style={{ marginBottom: 28 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>
                Mot de passe
              </Text>
              <View
                style={[
                  inputBase,
                  {
                    borderColor: focusedField === 'password' ? colors.primary : colors.border,
                    flexDirection: 'row', alignItems: 'center',
                  },
                ]}
              >
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={{ flex: 1, color: colors.text, fontSize: 16 }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  {showPassword ? (
                    <EyeOffIcon size={20} color={colors.textSecondary} />
                  ) : (
                    <EyeIcon size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Bouton Connexion */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>
                  Se connecter
                </Text>
              )}
            </TouchableOpacity>

            {/* Mot de passe oublié */}
            <TouchableOpacity style={{ marginTop: 16, marginBottom: 32 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 13 }}>
                Mot de passe oublié ?
              </Text>
            </TouchableOpacity>

            {/* Séparateur */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ color: colors.textSecondary, marginHorizontal: 16, fontSize: 13 }}>ou</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* Inscription */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.85}
              style={{
                borderWidth: 1.5, borderColor: colors.secondary,
                paddingVertical: 15, borderRadius: 12, alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.secondary, fontSize: 16, fontWeight: '700' }}>
                Créer un compte
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
