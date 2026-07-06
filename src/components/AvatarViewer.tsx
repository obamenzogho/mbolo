import React from 'react'
import { Modal, Pressable, Image, View, Dimensions } from 'react-native'

const { width } = Dimensions.get('window')

interface AvatarViewerProps {
  uri: string
  visible: boolean
  onClose: () => void
}

export function AvatarViewer({ uri, visible, onClose }: AvatarViewerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}
      >
        <Image
          source={{ uri }}
          style={{ width: width * 0.85, height: width * 0.85, borderRadius: width * 0.425 }}
          resizeMode="cover"
        />
      </Pressable>
    </Modal>
  )
}
