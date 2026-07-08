import { memo, useCallback } from 'react'
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { colors } from '@/lib/theme'

interface ExternalLinkCTAProps {
  url: string
  label?: string
}

function prettyDomain(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export const ExternalLinkCTA = memo(function ExternalLinkCTA({ url, label }: ExternalLinkCTAProps) {
  const open = useCallback(async () => {
    const safe = url.startsWith('http') ? url : `https://${url}`
    try { await Linking.openURL(safe) } catch {}
  }, [url])

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.8} style={styles.wrap}>
      <Ionicons name="link-outline" size={16} color={colors.secondary} />
      <Text style={styles.label} numberOfLines={1}>
        {label ?? 'Visiter mon site'}
      </Text>
      <Text style={styles.domain} numberOfLines={1}>
        {prettyDomain(url)}
      </Text>
      <Ionicons name="open-outline" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 8,
    maxWidth: '100%',
  },
  label: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  domain: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
})
