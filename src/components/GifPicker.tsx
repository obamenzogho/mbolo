import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  Image, StyleSheet, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { gifService, KlipyGifResult } from '../services/gifService'
import OrbitLoader from './OrbitLoader'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GIF_ITEM_SIZE = (SCREEN_WIDTH - 48) / 2

interface GifPickerProps {
  onSelect: (gifUrl: string, gifResult: KlipyGifResult) => void
  onClose?: () => void
}

const CATEGORIES = [
  { id: 'trending', label: 'Tendance', query: '' },
  { id: 'reaction', label: 'Réactions', query: 'reaction funny' },
  { id: 'love', label: 'Amour', query: 'love hearts' },
  { id: 'laugh', label: 'Rire', query: 'laughing funny' },
  { id: 'celebrate', label: 'Fête', query: 'celebration party' },
  { id: 'gabon', label: 'Gabon 🇬🇦', query: 'african gabon dance' },
  { id: 'africa', label: 'Afrique 🌍', query: 'africa dance' },
  { id: 'music', label: 'Musique 🎵', query: 'music dance' },
]

const STICKER_CATEGORIES = [
  { id: 'all', label: 'Tous' },
  { id: 'emoji', label: 'Emoji 😎' },
  { id: 'reaction', label: 'Réactions' },
  { id: 'memes', label: 'Memes' },
  { id: 'text', label: 'Texte' },
  { id: 'gabon', label: 'Gabon 🇬🇦' },
]

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [gifs, setGifs] = useState<KlipyGifResult[]>([])
  const [stickers, setStickers] = useState<KlipyGifResult[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('trending')
  const [activeStickerCategory, setActiveStickerCategory] = useState('all')
  const [viewMode, setViewMode] = useState<'gif' | 'sticker'>('gif')

  const loadGifs = useCallback(async (category?: string) => {
    setLoading(true)
    try {
      let results: KlipyGifResult[] = []
      if (category && category !== 'trending') {
        const cat = CATEGORIES.find(c => c.id === category)
        results = await gifService.search(cat?.query || category, 30)
      } else {
        results = await gifService.getTrending(30)
      }
      setGifs(results)
    } catch {
      setGifs([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStickers = useCallback(async (categoryId?: string) => {
    setLoading(true)
    try {
      let results: KlipyGifResult[] = []
      const cat = STICKER_CATEGORIES.find(c => c.id === categoryId)
      if (categoryId && categoryId !== 'all') {
        results = await gifService.searchStickers(cat?.label || categoryId, 30)
      } else {
        results = await gifService.getTrendingStickers(30)
      }
      setStickers(results)
    } catch {
      setStickers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'gif') {
      loadGifs(activeCategory)
    } else {
      loadStickers(activeStickerCategory)
    }
  }, [viewMode, activeCategory, activeStickerCategory])

  const handleSearch = useCallback(async (query: string) => {
    setSearch(query)
    if (!query.trim()) {
      if (viewMode === 'gif') {
        setActiveCategory('trending')
        loadGifs('trending')
      } else {
        setActiveStickerCategory('all')
        loadStickers('all')
      }
      return
    }
    setLoading(true)
    try {
      const results = viewMode === 'gif'
        ? await gifService.search(query, 30)
        : await gifService.searchStickers(query, 30)
      viewMode === 'gif' ? setGifs(results) : setStickers(results)
    } catch {
      viewMode === 'gif' ? setGifs([]) : setStickers([])
    } finally {
      setLoading(false)
    }
  }, [viewMode])

  const handleSelect = useCallback((item: KlipyGifResult) => {
    const url = gifService.getGifUrl(item)
    onSelect(url, item)
  }, [onSelect])

  const renderItem = useCallback(({ item }: { item: KlipyGifResult }) => {
    const thumbUrl = gifService.getThumbnailUrl(item)
    const dims = gifService.getGifDimensions(item)
    const aspectRatio = dims.width / dims.height

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item)}
        style={styles.gifItem}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: thumbUrl }}
          style={[styles.gifImage, aspectRatio > 0 ? { aspectRatio } : {}]}
          resizeMode="contain"
          fadeDuration={200}
        />
      </TouchableOpacity>
    )
  }, [handleSelect])

  const currentItems = viewMode === 'gif' ? gifs : stickers

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {viewMode === 'gif' ? 'GIFs' : 'Stickers'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'gif' ? 'sticker' : 'gif')}
            style={styles.viewToggle}
          >
            <Text style={styles.viewToggleText}>
              {viewMode === 'gif' ? 'Stickers' : 'GIFs'}
            </Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#666" style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={handleSearch}
            placeholder={`Rechercher ${viewMode === 'gif' ? 'un GIF' : 'un sticker'}...`}
            placeholderTextColor="#555"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={{ padding: 2 }}>
              <Ionicons name="close-circle" size={16} color="#555" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!search && (
        <View style={styles.categories}>
          <FlatList
            horizontal
            data={viewMode === 'gif' ? CATEGORIES : STICKER_CATEGORIES}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  if (viewMode === 'gif') {
                    setActiveCategory(item.id)
                  } else {
                    setActiveStickerCategory(item.id)
                  }
                  setSearch('')
                }}
                style={[
                  styles.categoryChip,
                  (viewMode === 'gif' ? activeCategory : activeStickerCategory) === item.id && styles.categoryChipActive
                ]}
              >
                <Text style={[
                  styles.categoryText,
                  (viewMode === 'gif' ? activeCategory : activeStickerCategory) === item.id && styles.categoryTextActive
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <OrbitLoader size={80} />
          <Text style={styles.loadingText}>
            Chargement des {viewMode === 'gif' ? 'GIFs' : 'stickers'}...
          </Text>
        </View>
      ) : currentItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>
            Aucun {viewMode === 'gif' ? 'GIF' : 'sticker'} trouvé
          </Text>
          <Text style={styles.emptySubtext}>Essaie une autre recherche</Text>
        </View>
      ) : (
        <FlatList
          data={currentItems}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  viewToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#222',
  },
  viewToggleText: {
    color: '#00A86B',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  categories: {
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#222',
    marginHorizontal: 4,
  },
  categoryChipActive: {
    backgroundColor: '#00A86B',
  },
  categoryText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContent: {
    padding: 8,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gifItem: {
    width: GIF_ITEM_SIZE,
    height: GIF_ITEM_SIZE,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#888',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#555',
    fontSize: 12,
  },
})