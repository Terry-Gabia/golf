import { useNotices } from '@/hooks/useNotices'
import { NoticeList } from '@/components/notice/NoticeList'

type Props = {
  currentUserId: string
}

export default function NoticesTab({ currentUserId }: Props) {
  const { notices, loading, addNotice, updateNotice, deleteNotice, joinNotice, leaveNotice } = useNotices(currentUserId)

  return (
    <NoticeList
      notices={notices}
      loading={loading}
      currentUserId={currentUserId}
      onAdd={addNotice}
      onUpdate={updateNotice}
      onDelete={deleteNotice}
      onJoin={joinNotice}
      onLeave={leaveNotice}
    />
  )
}
