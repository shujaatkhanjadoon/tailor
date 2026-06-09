'use client'
import { OrderCardSkeleton } from '@/components/ui/Skeleton'
function Loading() {
  return (
    <div className="px-4 pt-4 space-y-3 pb-20">
      <OrderCardSkeleton />
      <OrderCardSkeleton />
    </div>
  )
}
export default Loading
