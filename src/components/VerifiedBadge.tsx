import React from 'react'
import { Ionicons } from '@expo/vector-icons'

export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return <Ionicons name="checkmark-circle" size={size} color="#3897f0" style={{ marginLeft: 4 }} />
}
