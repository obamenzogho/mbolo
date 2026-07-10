import React, { useCallback, useMemo, useRef } from 'react'
import { View, Text } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { colors } from '../../lib/theme'
import CreateOption from './CreateOption'

interface CreateModalProps {
  onClose: () => void
}

const OPTIONS = [
  {
    icon: 'newspaper-outline',
    label: 'Publication',
    route: '/news-compose',
  },
  {
    icon: 'videocam-outline',
    label: 'Vidéo',
    route: '/(tabs)/camera',
  },
  {
    icon: 'time-outline',
    label: 'Story',
    route: '/story-upload',
  },
]

function CreateModalComponent({ onClose }: CreateModalProps) {
  const sheetRef = useRef<BottomSheet>(null)
  const insets = useSafeAreaInsets()
  const snapPoints = useMemo(() => ['52%'], [])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.65}
      />
    ),
    [],
  )

  const handleChange = useCallback((index: number) => {
    if (index === -1) onClose()
  }, [onClose])

  const handleOptionPress = useCallback((route: string) => {
    onClose()
    setTimeout(() => router.push(route as any), 100)
  }, [onClose])

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      backgroundStyle={{ backgroundColor: '#17181B' }}
      handleIndicatorStyle={{ backgroundColor: '#62656A' }}
    >
      <BottomSheetView
        style={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 20),
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 21,
            fontWeight: '700',
            marginBottom: 18,
          }}
        >
          Créer
        </Text>

        <View style={{ gap: 4 }}>
          {OPTIONS.map((option) => (
            <CreateOption
              key={option.label}
              icon={option.icon as any}
              label={option.label}
              onPress={() => handleOptionPress(option.route)}
            />
          ))}
        </View>
      </BottomSheetView>
    </BottomSheet>
  )
}

export default React.memo(CreateModalComponent)
