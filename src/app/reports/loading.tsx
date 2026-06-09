// src/app/reports/loading.tsx
'use client'
import { ReportSkeleton } from '@/components/ui/Skeleton'
export default function Loading() {
  return <div className="px-4 pt-16"><ReportSkeleton /></div>
}