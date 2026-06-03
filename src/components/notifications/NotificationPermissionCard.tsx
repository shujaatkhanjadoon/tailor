// src/components/notifications/NotificationPermissionCard.tsx
'use client'

import { Bell, X } from 'lucide-react'
import { useState } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { useTranslation } from 'react-i18next'

export function NotificationPermissionCard() {
  const { permission, requestPermission, isSupported } = useNotifications()
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('notif-banner-dismissed') === '1'
      : false
  )
  const { t } = useTranslation()

  // Don't show if: already granted, denied, unsupported, or dismissed
  if (!isSupported || permission !== 'default' || dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem('notif-banner-dismissed', '1')
    setDismissed(true)
  }

  const handleEnable = async () => {
    await requestPermission()
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center
                      justify-center shrink-0 mt-0.5">
        <Bell size={18} className="text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-800 text-sm">
          {t('notifications.title')}
        </p>
        <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
          {t('notifications.desc')}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleEnable}
            className="flex-1 bg-blue-600 text-white text-xs font-bold
                       py-2.5 rounded-xl transition-colors active:scale-95"
          >
            {t('notifications.enable')}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2.5 bg-white border border-blue-200
                       text-blue-600 text-xs font-semibold rounded-xl"
          >
            {t('notifications.later')}
          </button>
        </div>
      </div>

      <button onClick={handleDismiss} className="shrink-0 mt-0.5">
        <X size={15} className="text-blue-400" />
      </button>
    </div>
  )
}
