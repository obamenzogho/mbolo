import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Dimensions, Alert,
  SafeAreaView, Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OrbitLoader from './OrbitLoader'
import { useGallery, GalleryAsset } from '../hooks/useGallery'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const NUM_COLUMNS = 3
const ITEM_GAP = 2
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS

type TabType = 'all' | 'video' | 'photo'

interface GalleryPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (assets: GalleryAsset[]) => void
  maxSelection?: number
  allowVideo?: boolean
  allowPhoto?: boolean
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function GalleryPicker({
  visible,
  onClose,
  onSelect,
  maxSelection = 5,
  allowVideo = true,
  allowPhoto = true,
}: GalleryPickerProps) {
  const {
    permission,
    requestPermission,
    assets,
    loading,
    hasMore,
    selectedAssets,
    loadAssets,
    toggleSelection,
    clearSelection,
  } = useGallery()

  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) {
      clearSelection()
      setActiveTab('all')
    }
  }, [visible])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    clearSelection()
    if (tab === 'all') {
      loadAssets('all', true)
    } else if (tab === 'video') {
      loadAssets('video', true)
    } else {
      loadAssets('photo', true)
    }
  }, [clearSelection, loadAssets])

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadAssets(activeTab)
    }
  }, [hasMore, loading, activeTab, loadAssets])

  const handleConfirm = useCallback(async () => {
    if (selectedAssets.length === 0) return
    setSubmitting(true)
    try {
      await onSelect(selectedAssets)
      onClose()
    } catch (e) {
      console.error('select error:', e)
    } finally {
      setSubmitting(false)
    }
  }, [selectedAssets, onSelect, onClose])

  const handleClose = useCallback(() => {
    clearSelection()
    onClose()
  }, [clearSelection, onClose])

  const renderItem = useCallback(({ item }: { item: GalleryAsset }) => {
    const isVideo = item.mediaType === 'video'
    const isSelected = selectedAssets.some(a => a.id === item.id)
    const selectionIndex = selectedAssets.findIndex(a => a.id === item.id)

    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item)}
        style={styles.gridItem}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />

        {isVideo && item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        )}

        {isSelected && (
          <View style={styles.selectionOverlay}>
            <View style={styles.selectionBadge}>
              <Text style={styles.selectionText}>{selectionIndex + 1}</Text>
            </View>
          </View>
        )}

        {isSelected && (
          <View style={styles.selectedBorder} />
        )}
      </TouchableOpacity>
    )
  }, [selectedAssets, toggleSelection])

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
        <Ionicons name="close" size={24} color="#888" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>
        {selectedAssets.length > 0
          ? `${selectedAssets.length} sélectionné${selectedAssets.length > 1 ? 's' : ''}`
          : 'Sélectionner'}
      </Text>

      <TouchableOpacity
        onPress={handleConfirm}
        disabled={selectedAssets.length === 0 || submitting}
        style={[styles.headerBtn, selectedAssets.length === 0 && styles.headerBtnDisabled]}
      >
        {submitting ? (
          <OrbitLoader size={20} />
        ) : (
          <Text style={[styles.confirmText, selectedAssets.length === 0 && styles.confirmTextDisabled]}>
            Suivant
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )

  const renderTabs = () => (
    <View style={styles.tabs}>
      {[
        { key: 'all' as TabType, label: 'Tout', icon: 'grid' },
        { key: 'video' as TabType, label: 'Vidéos', icon: 'videocam' },
        { key: 'photo' as TabType, label: 'Photos', icon: 'image' },
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          onPress={() => handleTabChange(tab.key)}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
        >
          <Ionicons
            name={tab.icon as any}
            size={16}
            color={activeTab === tab.key ? '#fff' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  if (permission?.status !== 'granted') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="images-outline" size={64} color="#333" />
            <Text style={styles.permissionTitle}>Accès à la galerie</Text>
            <Text style={styles.permissionText}>
              Mbolo a besoin d'accéder à ta galerie pour que tu puisses sélectionner des photos et vidéos.
            </Text>
            <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
              <Text style={styles.permissionBtnText}>Autoriser</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
              <Text style={{ color: '#666', fontSize: 14 }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        {renderTabs()}

        <FlatList
          data={assets}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingFooter}>
                <OrbitLoader size={20} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>Aucun média trouvé</Text>
              </View>
            ) : null
          }
        />

        {selectedAssets.length > 0 && (
          <View style={styles.selectionBar}>
            <TouchableOpacity onPress={clearSelection} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={20} color="#FF4444" />
              <Text style={styles.clearText}>Effacer</Text>
            </TouchableOpacity>

            <View style={styles.previewRow}>
              {selectedAssets.slice(0, 5).map((asset, idx) => (
                <View key={asset.id} style={[styles.previewThumb, idx === 0 && styles.previewThumbFirst]}>
                  <Image source={{ uri: asset.uri }} style={styles.previewThumbImage} />
                  {asset.mediaType === 'video' && (
                    <View style={styles.previewVideoBadge}>
                      <Ionicons name="play" size={10} color="#fff" />
                    </View>
                  )}
                </View>
              ))}
              {selectedAssets.length === 0 && <Text style={{ color: '#888', fontSize: 12 }}>Aucune sélection</Text>}
            </View>

            <TouchableOpacity onPress={handleConfirm} style={styles.nextBtn}>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  headerBtn: {
    padding: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  headerBtnDisabled: {
    opacity: 0.4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmText: {
    color: '#00A86B',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmTextDisabled: {
    color: '#444',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#00A86B',
  },
  tabText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 100,
  },
  row: {
    marginBottom: ITEM_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginLeft: ITEM_GAP,
    position: 'relative',
    backgroundColor: '#111',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  selectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00A86B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  selectionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#00A86B',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    color: '#555',
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: '#00A86B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 34,
    borderTopWidth: 0.5,
    borderTopColor: '#222',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  clearText: {
    color: '#FF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  previewThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#333',
  },
  previewThumbFirst: {
    borderColor: '#00A86B',
  },
  previewThumbImage: {
    width: '100%',
    height: '100%',
  },
  previewVideoBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A86B',
    justifyContent: 'center',
    alignItems: 'center',
  },
})