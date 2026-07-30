import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'

export type FeedPagerIndex = 0 | 1 | 2 | 3

export interface FeedPagerRef {
  setPage: (index: FeedPagerIndex) => void
  setPageWithoutAnimation: (index: FeedPagerIndex) => void
}

interface FeedPagerProps {
  children: React.ReactNode
  initialPage: FeedPagerIndex
  onPageScroll: (event: {
    nativeEvent: {
      position: number
      offset: number
    }
  }) => void
  onPageSelected: (event: {
    nativeEvent: {
      position: number
    }
  }) => void
  onPageScrollStateChanged?: (event: {
    nativeEvent: {
      pageScrollState: 'idle' | 'dragging' | 'settling'
    }
  }) => void
}

const PAGE_COUNT = 4

const WebFeedPager = forwardRef<FeedPagerRef, FeedPagerProps>(
  function WebFeedPager(
    {
      children,
      initialPage,
      onPageScroll,
      onPageSelected,
      onPageScrollStateChanged,
    },
    ref,
  ) {
    const { width } = useWindowDimensions()
    const scrollRef = useRef<ScrollView>(null)
    const frameRef = useRef<number | null>(null)
    const [scrollWidth, setScrollWidth] = useState(width)

    const pages = useMemo(
      () => React.Children.toArray(children).slice(0, PAGE_COUNT),
      [children],
    )

    const emitPageScroll = useCallback(
      (offsetX: number) => {
        const pageWidth = scrollWidth || width || 1
        const rawPosition = Math.max(0, offsetX / pageWidth)
        const position = Math.min(
          PAGE_COUNT - 1,
          Math.floor(rawPosition),
        )
        const offset = Math.min(1, Math.max(0, rawPosition - position))

        onPageScroll({
          nativeEvent: {
            position,
            offset,
          },
        })
      },
      [onPageScroll, scrollWidth, width],
    )

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x

        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
        }

        frameRef.current = requestAnimationFrame(() => {
          emitPageScroll(offsetX)
        })

        onPageScrollStateChanged?.({
          nativeEvent: {
            pageScrollState: 'dragging',
          },
        })
      },
      [emitPageScroll, onPageScrollStateChanged],
    )

    const handleMomentumEnd = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const pageWidth = scrollWidth || width || 1
        const index = Math.max(
          0,
          Math.min(
            PAGE_COUNT - 1,
            Math.round(event.nativeEvent.contentOffset.x / pageWidth),
          ),
        ) as FeedPagerIndex

        onPageScroll({
          nativeEvent: {
            position: index,
            offset: 0,
          },
        })

        onPageSelected({
          nativeEvent: {
            position: index,
          },
        })

        onPageScrollStateChanged?.({
          nativeEvent: {
            pageScrollState: 'idle',
          },
        })
      },
      [
        onPageScroll,
        onPageSelected,
        onPageScrollStateChanged,
        scrollWidth,
        width,
      ],
    )

    useImperativeHandle(ref, () => ({
      setPage: (index) => {
        scrollRef.current?.scrollTo({
          x: index * (scrollWidth || width),
          animated: true,
        })
      },

      setPageWithoutAnimation: (index) => {
        scrollRef.current?.scrollTo({
          x: index * (scrollWidth || width),
          animated: false,
        })
      },
    }))

    return (
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        bounces={false}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentOffset={{
          x: initialPage * (scrollWidth || width),
          y: 0,
        }}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width

          if (nextWidth > 0 && nextWidth !== scrollWidth) {
            setScrollWidth(nextWidth)
          }
        }}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.pager}
        contentContainerStyle={[
          styles.content,
          {
            width: (scrollWidth || width) * PAGE_COUNT,
          },
        ]}
      >
        {pages.map((page, index) => (
          <View
            key={`feed-page-${index}`}
            style={[
              styles.page,
              {
                width: scrollWidth || width,
              },
            ]}
          >
            {page}
          </View>
        ))}
      </ScrollView>
    )
  },
)

const styles = StyleSheet.create({
  pager: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
    minHeight: '100%',
  },
})

export default WebFeedPager
