import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { colors } from '../lib/theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const ITEM_HEIGHT = 44
const VISIBLE_ITEMS = 5

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const JOURS = Array.from({ length: 31 }, (_, i) => i + 1)

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

const currentYear = new Date().getFullYear()
const MAX_YEAR = currentYear - 15
const ANNEES = range(1940, MAX_YEAR)

function PickerColumn({
  data,
  selectedIndex,
  onSelect,
  label,
}: {
  data: number[] | string[]
  selectedIndex: number
  onSelect: (index: number) => void
  label: string
}) {
  const scrollRef = useRef<ScrollView>(null)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false })
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const index = Math.round(y / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(index, data.length - 1))
    onSelect(clamped)
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true })
  }

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute', top: ITEM_HEIGHT * 2, left: 0, right: 0,
            height: ITEM_HEIGHT, backgroundColor: 'rgba(0,154,68,0.08)',
            borderTopWidth: 1, borderBottomWidth: 1,
            borderColor: colors.primary, zIndex: -1,
          }}
        />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          contentContainerStyle={{
            paddingTop: ITEM_HEIGHT * 2,
            paddingBottom: ITEM_HEIGHT * 2,
          }}
        >
          {data.map((item, i) => (
            <View key={i} style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: selectedIndex === i ? 17 : 15,
                  fontWeight: selectedIndex === i ? '700' : '400',
                  color: selectedIndex === i ? colors.text : colors.textSecondary,
                }}
              >
                {item}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

export default function DatePicker({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean
  onConfirm: (jour: number, mois: number, annee: number) => void
  onCancel: () => void
}) {
  const [jourIdx, setJourIdx] = useState(0)
  const [moisIdx, setMoisIdx] = useState(0)
  const [anneeIdx, setAnneeIdx] = useState(ANNEES.length - 1)

  const ageMin = currentYear - ANNEES[anneeIdx]
  const tropJeune = ageMin < 15

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 40,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row', justifyContent: 'space-between',
              padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Annuler</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
              Date de naissance
            </Text>
            <TouchableOpacity
              onPress={() => onConfirm(JOURS[jourIdx], moisIdx + 1, ANNEES[anneeIdx])}
            >
              <Text style={{ color: tropJeune ? colors.textSecondary : colors.primary, fontSize: 16, fontWeight: '700' }}>
                OK
              </Text>
            </TouchableOpacity>
          </View>

          {/* Colonnes */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 20 }}>
            <PickerColumn data={MOIS} selectedIndex={moisIdx} onSelect={setMoisIdx} label="Mois" />
            <PickerColumn data={JOURS} selectedIndex={jourIdx} onSelect={setJourIdx} label="Jour" />
            <PickerColumn data={ANNEES} selectedIndex={anneeIdx} onSelect={setAnneeIdx} label="Année" />
          </View>

          {tropJeune && (
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <View
                style={{
                  backgroundColor: 'rgba(248,81,73,0.1)',
                  borderRadius: 8, padding: 10,
                  borderWidth: 1, borderColor: colors.error,
                }}
              >
                <Text style={{ color: colors.error, fontSize: 13, textAlign: 'center' }}>
                  Tu dois avoir au moins 15 ans pour utiliser Mbolo
                </Text>
              </View>
            </View>
          )}

          {/* Indice */}
          <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            Moins de 15 ans : inscription refusée
          </Text>
        </View>
      </View>
    </Modal>
  )
}
