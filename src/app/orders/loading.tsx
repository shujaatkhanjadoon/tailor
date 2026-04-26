// src/app/orders/loading.tsx
import { OrderCardSkeleton } from '@/components/ui/Skeleton'
export default function Loading() {
  return (
    <div className="px-4 pt-16">
      {Array.from({ length: 5 }).map((_, i) => <OrderCardSkeleton key={i} />)}
    </div>
  )
}