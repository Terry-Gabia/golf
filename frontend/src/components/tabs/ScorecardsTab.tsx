import { useGolfRounds } from '@/hooks/useGolfRounds'
import { ScorecardList } from '@/components/golf/ScorecardList'

type Props = {
  currentUserId: string
}

export default function ScorecardsTab({ currentUserId }: Props) {
  const { rounds, loading, addRound, updateRound, deleteRound } = useGolfRounds(currentUserId)

  return (
    <ScorecardList
      currentUserId={currentUserId}
      rounds={rounds}
      loading={loading}
      onAdd={addRound}
      onUpdate={updateRound}
      onDelete={deleteRound}
    />
  )
}
