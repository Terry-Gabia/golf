import { useGallery } from '@/hooks/useGallery'
import { GalleryTab } from '@/components/gallery/GalleryTab'

type Props = {
  currentUserId: string
  userEmail: string | null
}

export default function GalleryTabContainer({ currentUserId, userEmail }: Props) {
  const {
    items,
    loading,
    uploadItem,
    deleteItem,
    fetchComments,
    addComment,
    deleteComment,
    incrementView,
  } = useGallery(currentUserId, userEmail)

  return (
    <GalleryTab
      items={items}
      loading={loading}
      currentUserId={currentUserId}
      onUpload={uploadItem}
      onDelete={deleteItem}
      onFetchComments={fetchComments}
      onAddComment={addComment}
      onDeleteComment={deleteComment}
      onView={incrementView}
    />
  )
}
