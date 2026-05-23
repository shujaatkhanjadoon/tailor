import { CustomerCardSkeleton } from '@/components/ui/Skeleton'
export default function Loading() {
  return (
    <div className="px-4 pt-16">
      {Array.from({ length: 6 }).map((_, i) => <CustomerCardSkeleton key={i} />)}
    </div>
  )
}
