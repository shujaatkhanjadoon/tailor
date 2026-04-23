// src/app/settings/notifications/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { NotificationSettingsPanel } from '@/components/notifications/NotificationSettingsPanel'

export default function NotificationsSettingsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4
                         flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Notifications</h1>
          <p className="text-xs text-slate-400">Due orders ki yaad dahi</p>
        </div>
      </header>

      <div className="px-4 pt-5">
        <NotificationSettingsPanel />
      </div>
    </div>
  )
}