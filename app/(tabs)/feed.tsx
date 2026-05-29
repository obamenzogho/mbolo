import { useIsFocused } from '@react-navigation/native'
import FeedTabsScreen from '../../src/features/feed/FeedTabsScreen'

export default function Feed() {
  const isFocusedTab = useIsFocused()
  return <FeedTabsScreen isTabFocused={isFocusedTab} />
}
