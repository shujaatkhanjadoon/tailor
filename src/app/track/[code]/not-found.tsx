// src/app/track/[code]/not-found.tsx
import { Scissors, SearchX } from 'lucide-react'

export default function TrackNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-5">
        <SearchX size={28} className="text-slate-500" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Order Nahi Mila</h1>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed mb-6">
        Yeh order number galat hai ya order exist nahi karta.
        Apne darzi se sahi link maangein.
      </p>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
          <Scissors size={12} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-600">MeraDarzi</span>
      </div>
    </div>
  )
}
