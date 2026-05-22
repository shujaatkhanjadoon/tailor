import { db, type PhotoRecord } from '@/lib/db/schema'
import { deleteFromCloudinary } from '@/lib/photos/cloudinary'
import { supabase } from '@/lib/supabase/client'

type PhotoDeleteTarget = Pick<PhotoRecord, 'id'> & {
  publicId?: string | null
}

export async function deleteOrderPhotoEverywhere(
  photo:    PhotoDeleteTarget,
  shopId:   string,
  memberId: string,
): Promise<void> {
  let publicId = photo.publicId?.trim()

  if (!publicId) {
    const { data, error } = await (supabase as any)
      .from('order_photos')
      .select('public_id')
      .eq('id', photo.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    publicId = data?.public_id?.trim()
  }

  if (publicId) {
    const deleted = await deleteFromCloudinary(publicId, shopId, memberId)
    if (!deleted) throw new Error('Cloudinary photo delete failed')
  }

  const { error } = await (supabase as any)
    .from('order_photos')
    .delete()
    .eq('id', photo.id)
  if (error) throw new Error(error.message)

  await db.photos.delete(photo.id).catch(() => undefined)
}
