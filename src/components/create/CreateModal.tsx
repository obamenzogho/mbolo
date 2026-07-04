import React, { useCallback, useMemo, useRef } from 'react'
import { View, Text } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { colors } from '../../lib/theme'
import CreateOption from './CreateOption'

interface CreateModalProps {
  onClose: () => void
}

const OPTIONS = [
  { icon: 'camera-outline', label: 'Caméra', route: '/(tabs)/camera' },
  { icon: 'time-outline', label: 'Story', route: '/story-upload' },
  { icon: 'document-text-outline', label: 'Brouillons', route: '/(tabs)/drafts' },
]

function CreateModalComponent({ onClose }: CreateModalProps) {
  const sheetRef = useRef<BottomSheet>(null)
  const insets = useSafeAreaInsets()

  const snapPoints = useMemo(() => ['45%'], [])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
        onPress={onClose}
      />
    ),
    [onClose],
  )

  const handleChange = useCallback((index: number) => {
    if (index === -1) onClose()
  }, [onClose])

  const handleOptionPress = useCallback((route: string) => {
    onClose()
    router.push(route as any)
  }, [onClose])

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: '#444', width: 40 }}
      onChange={handleChange}
    >
      <BottomSheetView style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
        <Text style={{ color: colors.white, fontSize: 20, fontWeight: '800', marginBottom: 24, textAlign: 'center' }}>
          Créer
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {OPTIONS.map((option, index) => (
            <CreateOption
              key={option.label}
              icon={option.icon}
              label={option.label}
              index={index}
              onPress={() => handleOptionPress(option.route)}
            />
          ))}
        </View>
      </BottomSheetView>
    </BottomSheet>
  )
}

export default React.memo(CreateModalComponent)
