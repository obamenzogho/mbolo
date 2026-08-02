/* src/features/news/components/VideoPickerModal.tsx

   Sélecteur d'une vidéo possédée par l'utilisateur, à partager dans un post
   « video_share ». Réutilise la source de données du profil (useProfileTabs,
   onglet 'grid') et la cellule miniature du profil. Sélection unique :
   un tap sur une vignette renvoie l'objet Video complet et ferme la modale. */

import { memo, useCallback } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import OrbitLoader from '@/components/OrbitLoader'
import { VideoThumbnailCell } from '@/components/VideoThumbnailCell'
import { useProfileTabs } from '@/hooks/useProfileTabs'
import { colors } from '@/lib/theme'
import type { Video as VideoType } from '@/types'

interface VideoPickerModalProps {
  visible: boolean
  userId: string
  onClose: () => void
  onSelect: (video: VideoType) => void
}

const NUM_COLUMNS = 3

function VideoPickerModalComponent({ visible, userId, onClose, onSelect }: VideoPickerModalProps) {
  const { gridVideos, loading, refreshing, onRefresh, loadMore, hasMore } = useProfileTabs({
    userId,
    tabs: ['grid'],
  })

  const handlePress = useCallback(
    (videoId: string) => {
      const video = gridVideos.find((v) => v.id === videoId)
      if (video) onSelect(video)
    },
    [gridVideos, onSelect],
  )

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) loadMore()
  }, [hasMore, loading, loadMore])

  const renderItem = useCallback(
    ({ item }: { item: VideoType }) => (
      <VideoThumbnailCell item={item} onPress={handlePress} />
    ),
    [handlePress],
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerButton}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Choisir une vidéo</Text>
          <View style={styles.headerButton} />
        </View>

        {loading && gridVideos.length === 0 ? (
          <View style={styles.center}>
            <OrbitLoader size={48} />
          </View>
        ) : gridVideos.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="videocam-outline" size={44} color="#444" />
            <Text style={styles.emptyText}>Tu n'as pas encore publié de vidéo.</Text>
          </View>
        ) : (
          <FlatList
            data={gridVideos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={NUM_COLUMNS}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.6}
            ListFooterComponent={
              loading && gridVideos.length > 0 ? (
                <View style={styles.footer}><OrbitLoader size={32} /></View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

export const VideoPickerModal = memo(VideoPickerModalComponent)

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: {
    minHeight: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2B2E',
  },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center' },
  footer: { paddingVertical: 20 },
})
