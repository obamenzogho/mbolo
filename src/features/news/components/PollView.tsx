import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { colors } from '@/lib/theme'
import type { NewsPoll } from '../types'

export default function PollView({ poll, postId, currentUserId }: { poll: NewsPoll; postId: string; currentUserId: string }) {
  const [localPoll, setLocalPoll] = useState(poll)
  const myVote = localPoll.options.find((o) => o.votedBy.includes(currentUserId))
  const totalVotes = localPoll.options.reduce((sum, o) => sum + o.votes, 0)

  const vote = async (optionId: string) => {
    if (myVote) return

    const optimistic = (p: NewsPoll): NewsPoll => ({
      ...p,
      options: p.options.map((o) => o.id === optionId
        ? { ...o, votes: o.votes + 1, votedBy: [...o.votedBy, currentUserId] }
        : o),
    })

    setLocalPoll(optimistic)

    try {
      // Intention uniquement : le recalcule de poll.options (votes/votedBy)
      // est fait par la Cloud Function onPostPollVoteWrite.
      await setDoc(
        doc(db, 'posts', postId, 'pollVotes', currentUserId),
        {
          userId: currentUserId,
          optionId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (error) {
      setLocalPoll((p) => ({
        ...p,
        options: p.options.map((o) => o.id === optionId
          ? {
              ...o,
              votes: Math.max(0, o.votes - 1),
              votedBy: o.votedBy.filter((u) => u !== currentUserId),
            }
          : o),
      }))

      captureException(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'PollView.vote', postId, optionId },
      )
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.question}>{localPoll.question}</Text>
      {localPoll.options.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
        const mine = opt.votedBy.includes(currentUserId)
        return (
          <Pressable key={opt.id} onPress={() => vote(opt.id)} disabled={!!myVote} style={styles.option}>
            {myVote && <View style={[styles.fill, { width: `${pct}%`, backgroundColor: mine ? colors.primary + '55' : '#2A2C31' }]} />}
            <Text style={styles.optionText}>{opt.text}</Text>
            {myVote && <Text style={styles.pct}>{pct}%</Text>}
          </Pressable>
        )
      })}
      {totalVotes > 0 && <Text style={styles.total}>{totalVotes} vote{totalVotes > 1 ? 's' : ''}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingBottom: 12 },
  question: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  option: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: '#3A3C40', marginBottom: 8, justifyContent: 'center', paddingHorizontal: 14, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  optionText: { color: '#EDEDED', fontSize: 14, fontWeight: '600' },
  pct: { position: 'absolute', right: 14, color: '#fff', fontSize: 13, fontWeight: '700' },
  total: { color: '#888', fontSize: 12, marginTop: 2 },
})
