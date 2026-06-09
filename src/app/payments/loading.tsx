'use client'
import { PaymentCardSkeleton } from '@/components/ui/Skeleton'
function Loading() {
  return (
    <div className="px-4 pt-4 space-y-3 pb-20">
      {Array.from({ length: 5 }).map((_, i) => <PaymentCardSkeleton key={i} />)}
    </div>
  )
}
export default Loading
