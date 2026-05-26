import React, { useMemo } from 'react'
import { View, StyleSheet, Image } from 'react-native'
import { colors } from '../lib/theme'

function generateMatrix(data: string, size: number = 25): boolean[][] {
  const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false))
  const finder = [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,2]]

  for (const [r, c] of finder) {
    for (const dr of [-1, 0, 1]) {
      for (const dc of [-1, 0, 1]) {
        if (dr === 0 && dc === 0) {
          matrix[r][c] = true
          matrix[6 - r][c] = true
          matrix[r][6 - c] = true
        } else if (Math.abs(dr) + Math.abs(dc) === 2) {
          matrix[r + dr][c + dc] = false
          matrix[6 - r + dr][c + dc] = false
          matrix[r + dr][6 - c + dc] = false
        }
      }
    }
  }

  const bytes = encodeURIComponent(data).split('%').length - 1
  const dataBytes = Math.ceil(bytes * 8)
  const fillBytes = Math.min(dataBytes, size * size - 100)
  const bitStr = data.repeat(3).slice(0, fillBytes).split('').map((_, i) =>
    i % 2 === 0 ? '1' : '0'
  ).join('')

  let idx = 0
  outer: for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const ac = col - c
        if (idx < bitStr.length && !isReserved(row, ac, size)) {
          matrix[row][ac] = bitStr[idx++] === '1'
        }
        if (idx >= bitStr.length) break outer
      }
    }
    for (let row = size - 1; row >= 0; row--) {
      for (let c = 0; c < 2; c++) {
        const ac = col - 1 + c
        if (idx < bitStr.length && !isReserved(row, ac, size)) {
          matrix[row][ac] = bitStr[idx++] === '1'
        }
        if (idx >= bitStr.length) break outer
      }
    }
  }

  return matrix
}

function isReserved(row: number, col: number, size: number): boolean {
  if (row < 9 && col < 9) return true
  if (row < 9 && col >= size - 8) return true
  if (row >= size - 8 && col < 9) return true
  if (row === 6 || col === 6) return true
  return false
}

interface QRCodeViewProps {
  data: string
  size?: number
  foreground?: string
  background?: string
}

export default function QRCodeView({ data, size = 200, foreground = '#000000', background = '#ffffff' }: QRCodeViewProps) {
  const matrix = useMemo(() => generateMatrix(data, 25), [data])

  const cellSize = size / 25

  return (
    <View style={{ width: size, height: size, backgroundColor: background, padding: 2 }}>
      <View style={{ flexDirection: 'column' }}>
        {matrix.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row' }}>
            {row.map((cell, colIdx) => (
              <View
                key={colIdx}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cell ? foreground : background,
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}