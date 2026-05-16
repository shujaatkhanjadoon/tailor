// src/components/notifications/NotificationSettingsPanel.tsx
'use client'

import {
  Bell, BellOff, AlertTriangle, Clock,
  CalendarCheck, Play, CheckCircle2, Settings2,
} from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { ToggleSwitch } from '@/components/ui/toggle-switch'

interface ToggleRowProps {
  icon:      React.ReactNode
  label:     string
  sublabel?: string
  value:     boolean
  onChange:  (v: boolean) => void
  disabled?: boolean
}

function ToggleRow({ icon, label, sublabel, value, onChange, disabled }: ToggleRowProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 py-3.5 border-b border-slate-100 last:border-0',
      disabled && 'opacity-40'
    )}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      <ToggleSwitch
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
        label={label}
      />
    </div>
  )
}

export function NotificationSettingsPanel() {
  const {
    permission, isGranted, isDenied, isSupported,
    settings, updateSetting,
    requestPermission, testNotification, testing,
  } = useNotifications()

  if (!isSupported) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
        <BellOff size={32} className="text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-600 text-sm">
          Is browser mein notifications support nahi hain
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Chrome ya Firefox use karein
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Permission status card */}
      <div className={cn(
        'rounded-2xl p-4 border',
        isGranted
          ? 'bg-green-50 border-green-200'
          : isDenied
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            isGranted ? 'bg-green-200' : isDenied ? 'bg-red-200' : 'bg-amber-200'
          )}>
            {isGranted
              ? <Bell size={18} className="text-green-700" />
              : <BellOff size={18} className={isDenied ? 'text-red-700' : 'text-amber-700'} />
            }
          </div>
          <div className="flex-1">
            <p className={cn(
              'font-bold text-sm',
              isGranted ? 'text-green-800' : isDenied ? 'text-red-800' : 'text-amber-800'
            )}>
              {isGranted
                ? 'Notifications On Hain ✓'
                : isDenied
                ? 'Notifications Block Hain'
                : 'Notifications Off Hain'}
            </p>
            <p className={cn(
              'text-xs mt-0.5',
              isGranted ? 'text-green-600' : isDenied ? 'text-red-600' : 'text-amber-600'
            )}>
              {isGranted
                ? 'Aapko due orders ki yaad dilai jayegi'
                : isDenied
                ? 'Browser settings mein manually on karein'
                : 'Neeche button se on karein'}
            </p>
          </div>
        </div>

        {/* Enable button if not granted */}
        {!isGranted && !isDenied && (
          <button
            onClick={requestPermission}
            className="w-full mt-3 bg-amber-600 text-white font-bold py-3
                       rounded-xl text-sm transition-colors active:scale-[0.98]"
          >
            🔔 Notifications On Karein
          </button>
        )}

        {/* Browser settings hint if denied */}
        {isDenied && (
          <div className="mt-3 bg-red-100 rounded-xl p-3">
            <p className="text-xs text-red-700 leading-relaxed">
              <strong>Chrome:</strong> Address bar mein 🔒 lock icon → Site settings → Notifications → Allow
            </p>
          </div>
        )}
      </div>

      {/* Main toggle */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 overflow-hidden">
        <ToggleRow
          icon={<Bell size={18} className="text-blue-600" />}
          label="Notifications Enable"
          sublabel="Sab notifications on/off"
          value={settings.enabled}
          onChange={v => updateSetting('enabled', v)}
          disabled={!isGranted}
        />
      </div>

      {/* Alert types */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 overflow-hidden">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-3 pb-1">
          Kab Batayein?
        </p>

        <ToggleRow
          icon={<AlertTriangle size={18} className="text-red-500" />}
          label="Deri Wale Orders"
          sublabel="Jab order ka waqt guzar jaye"
          value={settings.overdueAlerts}
          onChange={v => updateSetting('overdueAlerts', v)}
          disabled={!isGranted || !settings.enabled}
        />
        <ToggleRow
          icon={<Clock size={18} className="text-amber-500" />}
          label="Aaj Due Hain"
          sublabel="Aaj tayyar hone wale orders"
          value={settings.dueTodayAlerts}
          onChange={v => updateSetting('dueTodayAlerts', v)}
          disabled={!isGranted || !settings.enabled}
        />
        <ToggleRow
          icon={<CalendarCheck size={18} className="text-blue-500" />}
          label="Kal Due Hain"
          sublabel="Kal ki tayari ke liye"
          value={settings.dueTomorrowAlerts}
          onChange={v => updateSetting('dueTomorrowAlerts', v)}
          disabled={!isGranted || !settings.enabled}
        />
      </div>

      {/* Schedule times */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 overflow-hidden">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-3 pb-1">
          Waqt
        </p>
        {[
          { key: 'morningTime' as const, label: 'Subah Ka Waqt',  emoji: '🌅' },
          { key: 'eveningTime' as const, label: 'Shaam Ka Waqt',  emoji: '🌆' },
        ].map(({ key, label, emoji }) => (
          <div key={key} className="flex items-center gap-3 py-3.5 border-b border-slate-100 last:border-0">
            <span className="text-xl flex-shrink-0">{emoji}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{label}</p>
            </div>
            <input
              type="time"
              value={settings[key]}
              onChange={e => updateSetting(key, e.target.value)}
              disabled={!isGranted || !settings.enabled}
              className="text-sm font-bold text-slate-700 bg-slate-100 border border-slate-200
                         rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-colors
                         disabled:opacity-40"
            />
          </div>
        ))}
      </div>

      {/* Test button */}
      {isGranted && (
        <button
          onClick={testNotification}
          disabled={testing}
          className="w-full flex items-center justify-center gap-2 bg-slate-100
                     hover:bg-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl
                     text-sm transition-colors active:scale-[0.98]"
        >
          {testing ? (
            <><CheckCircle2 size={16} className="text-green-600" /> Notification Bheji!</>
          ) : (
            <><Play size={16} /> Test Notification Bhejein</>
          )}
        </button>
      )}

      {/* Info box */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          💡 Notifications tabhi aati hain jab app khulli ho ya background mein chale.
          App band ho to agle khulne par check hoga. PWA install karne se better results milte hain.
        </p>
      </div>
    </div>
  )
}
