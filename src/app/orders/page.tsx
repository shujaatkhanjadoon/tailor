import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { OrdersContent } from "@/components/orders/OrdersContent";
import { OrderCardSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Orders",
  description: "View and manage all tailoring orders. Filter by status, search customers, and track order progress.",
  openGraph: {
    title: "Orders - Mera Darzi",
    description: "View and manage all tailoring orders.",
  },
};

export default function OrdersPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-slate-50 pb-20">
          <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-4 h-36" />
          <div className="px-4 pt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }>
        <OrdersContent />
      </Suspense>
    </ErrorBoundary>
  )
}
