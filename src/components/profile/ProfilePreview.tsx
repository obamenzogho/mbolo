import { memo } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

interface Props {
  nom: string
  pseudo: string
  bio: string
  photoURL: string
  externalLink: string
}

export const ProfilePreview = memo(function ProfilePreview({ nom, pseudo, bio, photoURL, externalLink }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.hint}>Aperçu</Text>
      <View style={styles.row}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholder]}>
            <Ionicons name="person" size={26} color="#555" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.nom} numberOfLines={1}>{nom || 'Ton nom'}</Text>
          <Text style={styles.pseudo} numberOfLines={1}>@{(pseudo || 'pseudo').toLowerCase()}</Text>
        </View>
      </View>
      {bio ? <Text style={styles.bio} numberOfLines={3}>{bio}</Text> : null}
      {externalLink ? (
        <View style={styles.linkRow}>
          <Ionicons name="link-outline" size={13} color={colors.secondary} />
          <Text style={styles.link} numberOfLines={1}>{externalLink.replace(/^https?:\/\//, '')}</Text>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceLight, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  hint: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  placeholder: { backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  nom: { color: colors.white, fontSize: 16, fontWeight: '800' },
  pseudo: { color: colors.textMuted, fontSize: 14 },
  bio: { color: colors.white, fontSize: 13, lineHeight: 18, marginTop: 10 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  link: { color: colors.secondary, fontSize: 13, flexShrink: 1 },
})
