import { memo } from 'react'
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../lib/theme'
import { RepostButton } from '@/features/repost/components/RepostButton'
import { ShareButton } from '@/features/share/components/ShareButton'

// Colonne d'action façon Facebook / TikTok : icônes de taille égale, libellés
// identiques (même poids + ombre) et espacement constant, pour un rythme
// vertical régulier. Le positionnement (bas-droite, safe area) est géré par le
// parent (FeedItem) ; ce composant ne fait QUE la pile.
const ICON_SIZE = 30
const ITEM_GAP = 18

const fmt = (n: number) => n > 0 ? (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)) : null

interface ActionBarProps {
  liked: boolean
  saved: boolean
  likeCount: number
  saveCount: number
  commentCount: number
  likeIconScale: Animated.Value
  onLike: () => void
  onSave: () => void
  onComment: () => void
  onShare: () => void
  onMore: () => void
  onRepostToggle: (reposted: boolean) => void
  video: any
}

export const ActionBar = memo(function ActionBar({
  liked, saved, likeCount, saveCount, commentCount,
  likeIconScale, onLike, onSave, onComment, onShare, onMore, onRepostToggle, video,
}: ActionBarProps) {
  return (
    <View style={styles.column} pointerEvents="auto">
      <TouchableOpacity style={styles.item} onPress={onLike} activeOpacity={0.7}>
        <Animated.View style={{ transform: [{ scale: likeIconScale }] }}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={ICON_SIZE} color={liked ? colors.like : colors.white} />
        </Animated.View>
        <Text style={styles.label}>{fmt(likeCount) ?? "J'aime"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={onComment} activeOpacity={0.7}>
        <Ionicons name="chatbubble-outline" size={ICON_SIZE} color={colors.white} />
        <Text style={styles.label}>{fmt(commentCount) ?? 'Commenter'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={onSave} activeOpacity={0.7}>
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={ICON_SIZE} color={saved ? colors.save : colors.white} />
        <Text style={styles.label}>{fmt(saveCount) ?? 'Enregistrer'}</Text>
      </TouchableOpacity>

      <View style={styles.item}>
        <RepostButton video={video} size={ICON_SIZE} showLabel onRepost={onRepostToggle} />
      </View>

      <View style={styles.item}>
        <ShareButton onPress={onShare} size={ICON_SIZE} />
      </View>

      <TouchableOpacity style={styles.itemLast} onPress={onMore} activeOpacity={0.7}>
        <Ionicons name="ellipsis-horizontal" size={ICON_SIZE} color={colors.white} />
      </TouchableOpacity>
    </View>
  )
})

const styles = StyleSheet.create({
  column: { alignItems: 'center', zIndex: 30, elevation: 30 },
  item: { alignItems: 'center', marginBottom: ITEM_GAP },
  itemLast: { alignItems: 'center' },
  label: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
