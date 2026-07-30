/* FeedTabsHeader — barre d'onglets scrollable horizontalement,
   avec indicateur animé synchronisé au geste et auto-scroll
   sur l'onglet actif. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCreateModal } from '../../../contexts/CreateModalContext'
import CreateButton from '../../../components/create/CreateButton'

type TabIndex = 0 | 1 | 2 | 3

interface FeedTabsHeaderProps {
  scrollPosition: Animated.Value
  onTabPress: (index: TabIndex) => void
  cityLabel: string
  locationGranted: boolean
  onRequestLocation: () => void
  isNewsActive?: boolean
  headerTranslateY?: Animated.Value
}

const labels = ['Ville', 'Pour toi', 'Suivi', 'Actus'] as const
const TAB_COUNT = labels.length

export default function FeedTabsHeader({
  scrollPosition,
  onTabPress,
  cityLabel,
  locationGranted,
  onRequestLocation,
  isNewsActive = false,
  headerTranslateY,
}: FeedTabsHeaderProps) {
  const insets = useSafeAreaInsets()
  const { openCreateModal } = useCreateModal()
  const tabScrollRef = useRef<ScrollView>(null)

  const [tabX, setTabX] = useState(
    Array.from({ length: TAB_COUNT }, () => 0),
  )

  const [textWidth, setTextWidth] = useState(
    Array.from({ length: TAB_COUNT }, () => 0),
  )

  const handleTabLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { x } = event.nativeEvent.layout
      setTabX((previous) => {
        const next = [...previous]
        next[index] = x
        return next
      })
    },
    [],
  )

  const handleTextLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout
      setTextWidth((previous) => {
        const next = [...previous]
        next[index] = width
        return next
      })
    },
    [],
  )

  const indicatorX = useMemo(
    () =>
      scrollPosition.interpolate({
        inputRange: [0, 1, 2, 3],
        outputRange: tabX.map(
          (bx, i) => bx + (textWidth[i] > 0 ? 2 : 0),
        ),
        extrapolate: 'clamp',
      }),
    [scrollPosition, tabX, textWidth],
  )

  const indicatorWidth = useMemo(
    () =>
      scrollPosition.interpolate({
        inputRange: [0, 1, 2, 3],
        outputRange: textWidth,
        extrapolate: 'clamp',
      }),
    [scrollPosition, textWidth],
  )

  const opacityFor = useCallback(
    (index: number) =>
      scrollPosition.interpolate({
        inputRange: [
          Math.max(0, index - 1),
          index,
          Math.min(TAB_COUNT - 1, index + 1),
        ],
        outputRange: [0.5, 1, 0.5],
        extrapolate: 'clamp',
      }),
    [scrollPosition],
  )

  useEffect(() => {
    const listenerId = scrollPosition.addListener(({ value }) => {
      const activeIndex = Math.round(value)
      const active = tabX[activeIndex]

      if (active == null) return

      tabScrollRef.current?.scrollTo({
        x: Math.max(0, active - 80),
        animated: true,
      })
    })

    return () => {
      scrollPosition.removeListener(listenerId)
    }
  }, [scrollPosition, tabX])

  const handleCityPress = useCallback(() => {
    if (!locationGranted) {
      onRequestLocation()
    }

    onTabPress(0)
  }, [locationGranted, onRequestLocation, onTabPress])

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.header,
        {
          paddingTop: insets.top + 6,
          backgroundColor: isNewsActive
            ? '#111214'
            : 'rgba(8, 9, 10, 0.92)',
          transform: [
            { translateY: headerTranslateY ?? 0 },
          ],
        },
      ]}
    >
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.tabScrollContent}
        style={styles.tabScroll}
      >
        <View style={styles.tabsRow}>
          {labels.map((label, index) => {
            const visibleLabel =
              index === 0 && cityLabel
                ? cityLabel
                : label

            const onPress =
              index === 0
                ? handleCityPress
                : () => onTabPress(index as TabIndex)

            return (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={visibleLabel}
                onLayout={handleTabLayout(index)}
                onPress={onPress}
                style={styles.tabButton}
              >
                <Animated.Text
                  numberOfLines={1}
                  onLayout={handleTextLayout(index)}
                  style={[
                    styles.tabLabel,
                    { opacity: opacityFor(index) },
                  ]}
                >
                  {visibleLabel}
                </Animated.Text>
              </Pressable>
            )
          })}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: indicatorWidth,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rechercher"
          onPress={() => router.push('/explore' as never)}
          style={styles.actionButton}
        >
          <Ionicons
            name="search-outline"
            size={22}
            color="#fff"
          />
        </Pressable>

        <CreateButton
          onPress={openCreateModal}
          size={38}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    zIndex: 20,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 9, 10, 0.92)',
    paddingBottom: 8,
  },
  tabScroll: {
    flex: 1,
  },
  tabScrollContent: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  tabsRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  tabButton: {
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  tabLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#00C853',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
