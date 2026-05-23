import { PaymentCardSkeleton } from '@/components/ui/Skeleton'
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <PaymentCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
