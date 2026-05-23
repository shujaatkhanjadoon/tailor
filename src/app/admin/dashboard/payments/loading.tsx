import { PaymentCardSkeleton } from '@/components/ui/Skeleton'
export default function Loading() {
  return (
    <div className="px-4 pt-20">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <PaymentCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
