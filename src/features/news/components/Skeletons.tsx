import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated'

const SKELETON_COLOR = '#1A1B1E'
const SKELETON_SHIMMER = '#25272A'

function ShimmerBlock({ style }: { style?: any }) {
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [])

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return <Animated.View style={[{ backgroundColor: SKELETON_SHIMMER }, style, animStyle]} />
}

export function StoryCardSkeleton() {
  return (
    <View style={s.card}>
      <ShimmerBlock style={StyleSheet.absoluteFill} />
      <View style={s.avatarRing}>
        <View style={s.avatar} />
      </View>
      <View style={s.nameLine}>
        <ShimmerBlock style={{ width: 50, height: 10, borderRadius: 5 }} />
      </View>
    </View>
  )
}

export function PostCardSkeleton() {
  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <ShimmerBlock style={s.postAvatar} />
        <View style={{ flex: 1 }}>
          <ShimmerBlock style={{ width: '45%', height: 14, borderRadius: 7, marginBottom: 6 }} />
          <ShimmerBlock style={{ width: '25%', height: 10, borderRadius: 5 }} />
        </View>
      </View>

      <View style={s.postBody}>
        <ShimmerBlock style={{ width: '90%', height: 13, borderRadius: 6, marginBottom: 6 }} />
        <ShimmerBlock style={{ width: '70%', height: 13, borderRadius: 6 }} />
      </View>

      <ShimmerBlock style={s.postImage} />

      <View style={s.postActions}>
        <ShimmerBlock style={{ width: 60, height: 10, borderRadius: 5 }} />
        <ShimmerBlock style={{ width: 60, height: 10, borderRadius: 5 }} />
        <ShimmerBlock style={{ width: 60, height: 10, borderRadius: 5 }} />
      </View>
    </View>
  )
}

export function CommentSkeleton() {
  return (
    <View style={cs.container}>
      <ShimmerBlock style={cs.avatar} />
      <View style={cs.body}>
        <ShimmerBlock style={{ width: 90, height: 11, borderRadius: 5, marginBottom: 8 }} />
        <ShimmerBlock style={{ width: '85%', height: 13, borderRadius: 6, marginBottom: 6 }} />
        <ShimmerBlock style={{ width: '55%', height: 13, borderRadius: 6 }} />
        <View style={cs.actions}>
          <ShimmerBlock style={{ width: 50, height: 10, borderRadius: 5 }} />
          <ShimmerBlock style={{ width: 65, height: 10, borderRadius: 5 }} />
        </View>
      </View>
    </View>
  )
}

export function CommentSheetSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={cs.list}>
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </View>
  )
}

export function FollowListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <View style={fl.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={fl.row}>
          <ShimmerBlock style={fl.avatar} />
          <View style={fl.body}>
            <ShimmerBlock style={{ width: 100, height: 14, borderRadius: 7, marginBottom: 6 }} />
            <ShimmerBlock style={{ width: 70, height: 11, borderRadius: 5 }} />
          </View>
          <ShimmerBlock style={{ width: 60, height: 28, borderRadius: 6 }} />
        </View>
      ))}
    </View>
  )
}

const fl = StyleSheet.create({
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  body: { flex: 1 },
})

export function ProfileSkeleton() {
  return (
    <View style={ps.container}>
      {/* Top bar */}
      <View style={ps.topBar}>
        <ShimmerBlock style={{ width: 36, height: 36, borderRadius: 18 }} />
        <ShimmerBlock style={{ width: 100, height: 16, borderRadius: 8 }} />
        <ShimmerBlock style={{ width: 36, height: 36, borderRadius: 18 }} />
      </View>

      {/* Avatar + Stats */}
      <View style={ps.avatarRow}>
        <ShimmerBlock style={{ width: 90, height: 90, borderRadius: 45 }} />
        <View style={ps.statsRow}>
          <View style={ps.statItem}>
            <ShimmerBlock style={{ width: 32, height: 18, borderRadius: 4, marginBottom: 4 }} />
            <ShimmerBlock style={{ width: 24, height: 10, borderRadius: 5 }} />
          </View>
          <View style={ps.statItem}>
            <ShimmerBlock style={{ width: 32, height: 18, borderRadius: 4, marginBottom: 4 }} />
            <ShimmerBlock style={{ width: 24, height: 10, borderRadius: 5 }} />
          </View>
          <View style={ps.statItem}>
            <ShimmerBlock style={{ width: 32, height: 18, borderRadius: 4, marginBottom: 4 }} />
            <ShimmerBlock style={{ width: 24, height: 10, borderRadius: 5 }} />
          </View>
        </View>
      </View>

      {/* Name + username + bio */}
      <View style={ps.bioSection}>
        <ShimmerBlock style={{ width: 120, height: 15, borderRadius: 7, marginBottom: 6 }} />
        <ShimmerBlock style={{ width: 80, height: 12, borderRadius: 6, marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <ShimmerBlock style={{ width: 60, height: 12, borderRadius: 6 }} />
          <ShimmerBlock style={{ width: 40, height: 12, borderRadius: 6 }} />
        </View>
        <ShimmerBlock style={{ width: '70%', height: 12, borderRadius: 6, marginBottom: 4 }} />
        <ShimmerBlock style={{ width: '45%', height: 12, borderRadius: 6 }} />
      </View>

      {/* Highlights */}
      <View style={ps.highlights}>
        <ShimmerBlock style={{ width: 64, height: 64, borderRadius: 32 }} />
        <ShimmerBlock style={{ width: 64, height: 64, borderRadius: 32 }} />
        <ShimmerBlock style={{ width: 64, height: 64, borderRadius: 32 }} />
      </View>

      {/* Tabs */}
      <View style={ps.tabs}>
        <ShimmerBlock style={{ width: 60, height: 28, borderRadius: 6 }} />
        <ShimmerBlock style={{ width: 60, height: 28, borderRadius: 6 }} />
        <ShimmerBlock style={{ width: 60, height: 28, borderRadius: 6 }} />
        <ShimmerBlock style={{ width: 60, height: 28, borderRadius: 6 }} />
        <ShimmerBlock style={{ width: 60, height: 28, borderRadius: 6 }} />
      </View>

      {/* Grid placeholder */}
      <View style={ps.grid}>
        <ShimmerBlock style={ps.gridItem} />
        <ShimmerBlock style={ps.gridItem} />
        <ShimmerBlock style={ps.gridItem} />
        <ShimmerBlock style={ps.gridItem} />
        <ShimmerBlock style={ps.gridItem} />
        <ShimmerBlock style={ps.gridItem} />
      </View>
    </View>
  )
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingLeft: 16,
  },
  statItem: { alignItems: 'center' },
  bioSection: { paddingHorizontal: 16, paddingTop: 14 },
  highlights: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
  },
})

const cs = StyleSheet.create({
  list: { paddingHorizontal: 14 },
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 10,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  body: { flex: 1 },
  actions: { flexDirection: 'row', gap: 14, marginTop: 10 },
})

const s = StyleSheet.create({
  card: {
    width: 108,
    height: 168,
    marginRight: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: SKELETON_COLOR,
  },
  avatarRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: SKELETON_COLOR,
    padding: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: SKELETON_SHIMMER,
  },
  nameLine: {
    position: 'absolute',
    left: 8,
    bottom: 10,
  },
  postCard: {
    backgroundColor: '#111214',
    borderBottomWidth: 8,
    borderBottomColor: '#08090A',
    paddingBottom: 4,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 8,
    gap: 10,
  },
  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  postBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    backgroundColor: SKELETON_COLOR,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
})
