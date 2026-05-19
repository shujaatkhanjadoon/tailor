'use client'

import { StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

type StyleItem = {
  label: string
  value: string
  isCustom: boolean
}

function cleanOtherValue(value: string) {
  return value.startsWith('Other: ') ? value.slice('Other: '.length).trim() : value.trim()
}

function parseInstructions(value: string): { styles: StyleItem[]; note: string } {
  const [firstBlock, ...rest] = value.split(/\n\s*\n/)
  if (!firstBlock?.startsWith('Style: ')) {
    return { styles: [], note: value.trim() }
  }

  const styles = firstBlock
    .slice('Style: '.length)
    .split(' | ')
    .map(item => {
      const separator = item.indexOf(': ')
      if (separator === -1) return null
      const label = item.slice(0, separator).trim()
      const rawValue = item.slice(separator + 2).trim()
      if (!label || !rawValue) return null
      const isCustom = rawValue.includes('Other: ')
      return {
        label,
        value: rawValue
          .split(', ')
          .map(cleanOtherValue)
          .filter(Boolean)
          .join(', '),
        isCustom,
      }
    })
    .filter(Boolean) as StyleItem[]

  return {
    styles,
    note: rest.join('\n\n').trim(),
  }
}

export function SpecialInstructionsSummary({
  value,
  compact = false,
  className,
}: {
  value: string
  compact?: boolean
  className?: string
}) {
  const { styles, note } = parseInstructions(value)

  if (styles.length === 0 && !note) return null

  return (
    <div className={cn(
      'rounded-2xl border border-blue-100 bg-blue-50/70 p-3',
      compact && 'rounded-xl p-2.5',
      className
    )}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700">
        <StickyNote size={compact ? 12 : 13} />
        Khaas Hidayat
      </p>

      {styles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {styles.map(item => (
            <span
              key={`${item.label}-${item.value}`}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-semibold',
                item.isCustom
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-blue-200 bg-white text-blue-800'
              )}
            >
              <span className="text-slate-500">{item.label}:</span>{' '}
              {item.value || 'Custom style'}
            </span>
          ))}
        </div>
      )}

      {note && (
        <p className={cn(
          'whitespace-pre-line text-sm leading-relaxed text-slate-700',
          styles.length > 0 && 'mt-3 border-t border-blue-100 pt-3',
          compact && 'text-xs'
        )}>
          {note}
        </p>
      )}
    </div>
  )
}
