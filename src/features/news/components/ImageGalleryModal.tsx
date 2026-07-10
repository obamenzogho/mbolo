import { useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NewsPostMedia } from '../types'

const { width: W, height: H } = Dimensions.get('window')

interface Props {
  media: NewsPostMedia[]
  initialIndex?: number
  visible: boolean
  onClose: () => void
}

export default function ImageGalleryModal({
  media,
  initialIndex = 0,
  visible,
  onClose,
}: Props) {
  const [index, setIndex] = useState(initialIndex)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <FlatList
          data={media}
          horizontal
          pagingEnabled
          keyExtractor={(_, i) => String(i)}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({
            length: W,
            offset: W * i,
            index: i,
          })}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(
              e.nativeEvent.contentOffset.x / W,
            )
            setIndex(newIndex)
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image
                source={{ uri: item.url }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {media.length > 1 && (
          <Text style={styles.counter}>
            {index + 1} / {media.length}
          </Text>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  close: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slide: {
    width: W,
    height: H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: W,
    height: H * 0.8,
  },
  counter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
})
