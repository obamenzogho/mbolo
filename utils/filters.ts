export const MBOLO_FILTERS = [
  {
    id: 'normal',
    name: 'Normal',
    filter: null,
    previewStyle: null,
  },
  {
    id: 'gabon',
    name: 'Gabon 🇬🇦',
    ffmpegFilter: 'saturate',
    cssFilter: 'saturate(1.4) hue-rotate(80deg) brightness(1.05)',
    previewStyle: { backgroundColor: 'rgba(0,168,107,0.25)' },
  },
  {
    id: 'libreville',
    name: 'Libreville',
    ffmpegFilter: null,
    cssFilter: 'saturate(1.2) sepia(0.2) brightness(1.1)',
    previewStyle: { backgroundColor: 'rgba(255,165,0,0.2)' },
  },
  {
    id: 'nuit',
    name: 'Nuit',
    ffmpegFilter: null,
    cssFilter: 'brightness(0.8) contrast(1.3) saturate(0.8)',
    previewStyle: { backgroundColor: 'rgba(0,0,0,0.35)' },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    ffmpegFilter: null,
    cssFilter: 'sepia(0.5) contrast(1.1) brightness(0.95)',
    previewStyle: { backgroundColor: 'rgba(139,90,43,0.3)' },
  },
  {
    id: 'noir',
    name: 'Noir & Blanc',
    ffmpegFilter: null,
    cssFilter: 'grayscale(1) contrast(1.2)',
    previewStyle: { backgroundColor: 'rgba(128,128,128,0.25)' },
  },
  {
    id: 'chaud',
    name: 'Chaud',
    ffmpegFilter: null,
    cssFilter: 'sepia(0.3) saturate(1.1) hue-rotate(-10deg)',
    previewStyle: { backgroundColor: 'rgba(255,100,0,0.2)' },
  },
  {
    id: 'froid',
    name: 'Froid',
    ffmpegFilter: null,
    cssFilter: 'saturate(0.9) hue-rotate(180deg) brightness(1.05)',
    previewStyle: { backgroundColor: 'rgba(0,150,255,0.2)' },
  },
]

export const getCssFilter = (filterId: string): string => {
  const filter = MBOLO_FILTERS.find(f => f.id === filterId)
  return filter?.cssFilter || ''
}

export const getPreviewStyle = (filterId: string): object | null => {
  const filter = MBOLO_FILTERS.find(f => f.id === filterId)
  return filter?.previewStyle || null
}

export default MBOLO_FILTERS