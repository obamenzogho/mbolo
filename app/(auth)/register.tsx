import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { MboloLogo, EyeIcon, EyeOffIcon } from '../../src/components/Icons'
import DatePicker from '../../src/components/DatePicker'
import { router } from 'expo-router'

const AUTH_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'Cet email est déjà utilisé',
  'auth/invalid-email': 'Email invalide',
  'auth/weak-password': 'Mot de passe trop faible (minimum 6 caractères)',
  'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard',
  'auth/network-request-failed': 'Erreur réseau. Vérifie ta connexion',
}

function getFirebaseError(code: string): string {
  return AUTH_ERRORS[code] || 'Une erreur est survenue. Réessaie.'
}

function generateSuggestions(nom: string, base: string): string[] {
  const parts = nom.toLowerCase().split(/\s+/).filter(Boolean)
  const prenom = parts[0] || ''
  const nomFam = parts[parts.length - 1] || ''
  const initiale = prenom[0] || ''

  const candidates = new Set<string>()
  candidates.add(`${prenom}.${nomFam}`)
  candidates.add(`${prenom}_${nomFam}`)
  if (initiale && nomFam) candidates.add(`${initiale}${nomFam}`)
  if (prenom) candidates.add(`${prenom}${Math.floor(Math.random() * 900) + 100}`)
  if (nomFam) candidates.add(`${nomFam}${Math.floor(Math.random() * 900) + 100}`)
  candidates.add(`${prenom}_${nomFam}${Math.floor(Math.random() * 90) + 10}`)
  if (initiale && nomFam) candidates.add(`${initiale}.${nomFam}${Math.floor(Math.random() * 90) + 10}`)

  return Array.from(candidates).filter((c) => c !== base).slice(0, 4)
}

export default function Register() {
  const [nom, setNom] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle')
  const [dateModalVisible, setDateModalVisible] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState<{ jour: number; mois: number; annee: number } | null>(null)

  const inputBase = {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  }

  const evaluatePassword = (pwd: string) => {
    setPassword(pwd)
    let strength = 0
    if (pwd.length >= 6) strength++
    if (pwd.length >= 10) strength++
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) strength++
    setPasswordStrength(strength)
  }

  const strengthLabel = ['', 'Faible', 'Moyen', 'Fort']
  const strengthColor = ['', colors.error, colors.accent, colors.success]

  const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  const dateLabel = dateOfBirth
    ? `${dateOfBirth.jour} ${MOIS_NOMS[dateOfBirth.mois - 1]} ${dateOfBirth.annee}`
    : ''

  // ── Username check ──
  const checkUsername = useRef<{ last: string; timer: ReturnType<typeof setTimeout> | null }>({ last: '', timer: null })

  useEffect(() => {
    const trimmed = username.trim().toLowerCase()
    if (!trimmed || trimmed.length < 2) {
      setUsernameStatus('idle')
      setSuggestions([])
      return
    }

    if (checkUsername.current.timer) clearTimeout(checkUsername.current.timer)

    checkUsername.current.timer = setTimeout(async () => {
      if (trimmed === checkUsername.current.last) return
      checkUsername.current.last = trimmed
      setUsernameStatus('checking')

      try {
        const snap = await getDoc(doc(db, 'usernames', trimmed))
        if (snap.exists()) {
          setUsernameStatus('unavailable')
          if (nom.trim()) setSuggestions(generateSuggestions(nom, trimmed))
          return
        }

        const q = query(collection(db, 'users'), where('pseudo', '==', trimmed), limit(1))
        const existing = await getDocs(q)
        if (!existing.empty) {
          setUsernameStatus('unavailable')
          if (nom.trim()) setSuggestions(generateSuggestions(nom, trimmed))
        } else {
          setUsernameStatus('available')
          setSuggestions([])
        }
      } catch {
        setUsernameStatus('idle')
      }
    }, 500)

    return () => {
      if (checkUsername.current.timer) clearTimeout(checkUsername.current.timer)
    }
  }, [username, nom])

  // ── Email check ──
  const checkEmail = useRef<{ last: string; timer: ReturnType<typeof setTimeout> | null }>({ last: '', timer: null })

  useEffect(() => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@') || trimmed.length < 5) {
      setEmailStatus('idle')
      return
    }

    if (checkEmail.current.timer) clearTimeout(checkEmail.current.timer)

    checkEmail.current.timer = setTimeout(async () => {
      if (trimmed === checkEmail.current.last) return
      checkEmail.current.last = trimmed
      setEmailStatus('checking')

      try {
        const q = query(collection(db, 'users'), where('email', '==', trimmed), limit(1))
        const snap = await getDocs(q)
        setEmailStatus(snap.empty ? 'available' : 'unavailable')
      } catch {
        setEmailStatus('idle')
      }
    }, 500)

    return () => {
      if (checkEmail.current.timer) clearTimeout(checkEmail.current.timer)
    }
  }, [email])

  // ── Submit ──
  const handleRegister = async () => {
    Keyboard.dismiss()
    if (!nom || !username || !email || !dateOfBirth || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs')
      return
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères')
      return
    }

    if (password !== passwordConfirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      const usernameKey = username.trim().toLowerCase()

      const existing = await getDoc(doc(db, 'usernames', usernameKey))
      if (existing.exists()) {
        setUsernameStatus('unavailable')
        if (nom.trim()) setSuggestions(generateSuggestions(nom, usernameKey))
        Alert.alert('Nom pris', 'Ce nom d\'utilisateur est déjà pris. Choisis-en un autre.')
        setLoading(false)
        return
      }

      const q = query(collection(db, 'users'), where('pseudo', '==', usernameKey), limit(1))
      const userExisting = await getDocs(q)
      if (!userExisting.empty) {
        setUsernameStatus('unavailable')
        if (nom.trim()) setSuggestions(generateSuggestions(nom, usernameKey))
        Alert.alert('Nom pris', 'Ce nom d\'utilisateur est déjà pris. Choisis-en un autre.')
        setLoading(false)
        return
      }

      const emailTrimmed = email.trim().toLowerCase()
      const emailQ = query(collection(db, 'users'), where('email', '==', emailTrimmed), limit(1))
      const emailExisting = await getDocs(emailQ)
      if (!emailExisting.empty) {
        setEmailStatus('unavailable')
        Alert.alert('Email pris', 'Cet email est déjà utilisé. Connecte-toi ou utilise un autre email.')
        setLoading(false)
        return
      }

      const cred = await createUserWithEmailAndPassword(auth, emailTrimmed, password)
      await updateProfile(cred.user, { displayName: username })

      const dateStr = `${dateOfBirth.annee}-${String(dateOfBirth.mois).padStart(2, '0')}-${String(dateOfBirth.jour).padStart(2, '0')}`

      await setDoc(doc(db, 'users', cred.user.uid), {
        nom,
        pseudo: usernameKey,
        email: emailTrimmed,
        dateOfBirth: dateStr,
        photoURL: '',
        bio: '',
        followers: [],
        following: [],
        createdAt: serverTimestamp(),
      })

      await setDoc(doc(db, 'usernames', usernameKey), {
        uid: cred.user.uid,
        email: emailTrimmed,
      })

      router.replace('/(tabs)/feed')
    } catch (error: any) {
      Alert.alert('Erreur', getFirebaseError(error.code))
    } finally {
      setLoading(false)
    }
  }

  const handleDateConfirm = (jour: number, mois: number, annee: number) => {
    setDateOfBirth({ jour, mois, annee })
    setDateModalVisible(false)
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
            {/* Entête */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <MboloLogo size={60} />
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 14, textAlign: 'center' }}>
                Rejoins la communauté{'\n'}et partage ta passion avec le monde
              </Text>
            </View>

            {/* Nom complet */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Nom complet</Text>
              <View style={[inputBase, { borderColor: focusedField === 'nom' ? colors.primary : colors.border }]}>
                <TextInput
                  value={nom}
                  onChangeText={setNom}
                  placeholder="Jean Obiang"
                  placeholderTextColor={colors.textSecondary}
                  onFocus={() => setFocusedField('nom')}
                  onBlur={() => setFocusedField(null)}
                  style={{ color: colors.text, fontSize: 16 }}
                />
              </View>
            </View>

            {/* Nom d'utilisateur */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Nom d'utilisateur</Text>
              <View
                style={[
                  inputBase,
                  {
                    borderColor: usernameStatus === 'unavailable' ? colors.error
                      : usernameStatus === 'available' ? colors.success
                      : focusedField === 'username' ? colors.primary : colors.border,
                    flexDirection: 'row', alignItems: 'center',
                  },
                ]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginRight: 4 }}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  placeholder="jean_obiang"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  style={{ flex: 1, color: colors.text, fontSize: 16 }}
                />
                {username.length >= 2 && (
                  usernameStatus === 'checking' ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginLeft: 6 }} />
                  ) : usernameStatus === 'available' ? (
                    <Text style={{ color: colors.success, fontSize: 18, marginLeft: 6 }}>✓</Text>
                  ) : usernameStatus === 'unavailable' ? (
                    <Text style={{ color: colors.error, fontSize: 18, marginLeft: 6 }}>✕</Text>
                  ) : null
                )}
              </View>
              {usernameStatus === 'unavailable' && suggestions.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Suggestions disponibles :</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {suggestions.map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => { setUsername(s); setUsernameStatus('available'); setSuggestions([]) }}
                        style={{ backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.secondary }}
                      >
                        <Text style={{ color: colors.secondary, fontSize: 13 }}>@{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Email */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Email</Text>
              <View
                style={[
                  inputBase,
                  {
                    borderColor: emailStatus === 'unavailable' ? colors.error
                      : emailStatus === 'available' ? colors.success
                      : focusedField === 'email' ? colors.primary : colors.border,
                    flexDirection: 'row', alignItems: 'center',
                  },
                ]}
              >
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ton@email.com"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={{ flex: 1, color: colors.text, fontSize: 16 }}
                />
                {email.length >= 5 && email.includes('@') && (
                  emailStatus === 'checking' ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginLeft: 6 }} />
                  ) : emailStatus === 'available' ? (
                    <Text style={{ color: colors.success, fontSize: 18, marginLeft: 6 }}>✓</Text>
                  ) : emailStatus === 'unavailable' ? (
                    <Text style={{ color: colors.error, fontSize: 18, marginLeft: 6 }}>✕</Text>
                  ) : null
                )}
              </View>
            </View>

            {/* Date de naissance */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Date de naissance</Text>
              <TouchableOpacity
                onPress={() => setDateModalVisible(true)}
                activeOpacity={0.8}
                style={[
                  inputBase,
                  {
                    borderColor: dateOfBirth ? colors.primary : colors.border,
                    flexDirection: 'row', alignItems: 'center',
                    minHeight: 48,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={20} color={dateOfBirth ? colors.primary : colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={{ flex: 1, color: dateOfBirth ? colors.text : colors.textSecondary, fontSize: 16 }}>
                  {dateLabel || 'Sélectionne ta date de naissance'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {dateOfBirth && (
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                  {new Date().getFullYear() - dateOfBirth.annee >= 15
                    ? '✓ Âge vérifié'
                    : '✕ Tu dois avoir au moins 15 ans'}
                </Text>
              )}
            </View>

            {/* Mot de passe */}
            <View style={{ marginBottom: 4 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Mot de passe</Text>
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
                  onChangeText={evaluatePassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={{ flex: 1, color: colors.text, fontSize: 16 }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  {showPassword ? <EyeOffIcon size={20} color={colors.textSecondary} /> : <EyeIcon size={20} color={colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Force du mot de passe */}
            {password.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                  {[1, 2, 3].map((level) => (
                    <View
                      key={level}
                      style={{
                        flex: 1, height: 3, borderRadius: 2,
                        backgroundColor: passwordStrength >= level ? strengthColor[passwordStrength] : colors.border,
                      }}
                    />
                  ))}
                </View>
                <Text style={{ color: strengthColor[passwordStrength] || colors.textSecondary, fontSize: 11 }}>
                  {strengthLabel[passwordStrength]}
                </Text>
              </View>
            )}
            {password.length === 0 && <View style={{ marginBottom: 20 }} />}

            {/* Confirmer le mot de passe */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 13, fontWeight: '600' }}>Confirmer le mot de passe</Text>
              <View
                style={[
                  inputBase,
                  {
                    borderColor: !passwordConfirm ? colors.border
                      : password === passwordConfirm ? colors.success
                      : colors.error,
                    flexDirection: 'row', alignItems: 'center',
                  },
                ]}
              >
                <TextInput
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPasswordConfirm}
                  autoComplete="new-password"
                  onFocus={() => setFocusedField('passwordConfirm')}
                  onBlur={() => setFocusedField(null)}
                  style={{ flex: 1, color: colors.text, fontSize: 16 }}
                />
                <TouchableOpacity onPress={() => setShowPasswordConfirm(!showPasswordConfirm)} style={{ padding: 4 }}>
                  {showPasswordConfirm ? <EyeOffIcon size={20} color={colors.textSecondary} /> : <EyeIcon size={20} color={colors.textSecondary} />}
                </TouchableOpacity>
              </View>
              {passwordConfirm.length > 0 && password !== passwordConfirm && (
                <Text style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>Les mots de passe ne correspondent pas</Text>
              )}
            </View>

            {/* Conditions */}
            <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginBottom: 16, lineHeight: 16 }}>
              En cliquant sur S'inscrire, tu acceptes nos{' '}
              <Text style={{ color: colors.secondary }}>Conditions générales</Text>
              {' '}et notre{' '}
              <Text style={{ color: colors.secondary }}>Politique de confidentialité</Text>.
            </Text>

            {/* Bouton Inscription */}
            <TouchableOpacity
              onPress={handleRegister}
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
                marginBottom: 20,
              }}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>S'inscrire</Text>
              )}
            </TouchableOpacity>

            {/* Retour connexion */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Déjà un compte ?{' '}</Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: '700' }}>Connecte-toi</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePicker
        visible={dateModalVisible}
        onConfirm={handleDateConfirm}
        onCancel={() => setDateModalVisible(false)}
      />
    </SafeAreaView>
  )
}
