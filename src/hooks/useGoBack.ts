import { useContext } from 'react'
import { NavigationHistoryContext } from '../providers/NavigationHistoryProvider'

export function useGoBack() {
  return useContext(NavigationHistoryContext)
}
