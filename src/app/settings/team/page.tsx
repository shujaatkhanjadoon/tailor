// src/app/settings/team/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft }  from 'lucide-react'
import { TeamManager } from '@/components/team/TeamManager'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { AccessNotice } from '@/components/billing/AccessNotice'
import { useAuth }     from '@/lib/auth/AuthContext'

export default function TeamSettingsPage() {
  const router   = useRouter()
  const { isOwner } = useAuth()

  if (!isOwner) {
    return (
      <AccessNotice
        icon="role"
        title="Owner access required"
        message="Team management sirf owner ke liye hai. Karigar apna PIN settings se change kar sakte hain."
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4
                         flex items-center gap-3">
        <button
          aria-label="Go back"
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Hamare Karigar</h1>
          <p className="text-xs text-slate-400">Team add ya remove karein</p>
        </div>
      </header>

      {/* PIN reminder */}
      <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-amber-700 font-medium leading-relaxed">
          💡 Har karigar ka <strong>4-digit PIN</strong> hota hai login ke liye.
          PIN set karne ke baad karigar ko batayein — woh sirf unhe pata hona chahiye.
        </p>
      </div>

      <div className="px-4 mt-4">
        <FeatureGate feature="karigar" mode="blur">
          <TeamManager />
        </FeatureGate>
      </div>
    </div>
  )
}
