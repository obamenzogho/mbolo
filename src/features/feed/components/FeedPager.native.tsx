import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import PagerView from 'react-native-pager-view'

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

const NativeFeedPager = forwardRef<FeedPagerRef, FeedPagerProps>(
  function NativeFeedPager(
    {
      children,
      initialPage,
      onPageScroll,
      onPageSelected,
      onPageScrollStateChanged,
    },
    ref,
  ) {
    const pagerRef = useRef<PagerView>(null)

    useImperativeHandle(ref, () => ({
      setPage: (index) => {
        pagerRef.current?.setPage(index)
      },
      setPageWithoutAnimation: (index) => {
        pagerRef.current?.setPageWithoutAnimation(index)
      },
    }))

    return (
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={initialPage}
        offscreenPageLimit={1}
        overdrag={false}
        onPageScroll={onPageScroll}
        onPageSelected={onPageSelected}
        onPageScrollStateChanged={onPageScrollStateChanged}
      >
        {children}
      </PagerView>
    )
  },
)

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
})

export default NativeFeedPager
