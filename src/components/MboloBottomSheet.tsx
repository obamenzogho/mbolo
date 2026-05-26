import { useCallback, useMemo, ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, {
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'

interface MboloBottomSheetProps {
  sheetRef: React.RefObject<BottomSheet>
  snapPoints?: (string | number)[]
  children?: ReactNode
  title?: string
  onClose?: () => void
  showCloseButton?: boolean
  contentStyle?: object
}

export default function MboloBottomSheet({
  sheetRef,
  snapPoints = ['50%', '90%'],
  children,
  title,
  onClose,
  showCloseButton = false,
  contentStyle,
}: MboloBottomSheetProps) {
  const snapPointsMemo = useMemo(() => snapPoints, [snapPoints])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  )

  const handleClose = useCallback(() => {
    sheetRef.current?.close()
  }, [sheetRef])

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPointsMemo}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={(index) => {
        if (index === -1) onClose?.()
      }}
    >
      {(title || showCloseButton) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {showCloseButton && (
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      )}
      <BottomSheetScrollView contentContainerStyle={[styles.content, contentStyle]}>
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export { BottomSheetView, BottomSheetScrollView }

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: '#444',
    width: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingBottom: 40,
  },
})