// src/components/orders/wizard/StepIndicator.tsx
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number
  steps: string[]
  onBack: () => void
}

export function StepIndicator({ currentStep, steps, onBack }: StepIndicatorProps) {
  return (
    <div className="bg-white border-b border-slate-100 px-4 pt-12 lg:pt-6 pb-4">

      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full
                     bg-slate-100 text-slate-600 transition-colors active:bg-slate-200"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-xs text-slate-400 font-medium">
            Step {currentStep} of {steps.length}
          </p>
          <h1 className="text-lg font-bold text-slate-800">
            {steps[currentStep - 1]}
          </h1>
        </div>
      </div>

      {/* Step pills */}
      <div className="flex gap-2">
        {steps.map((label, i) => {
          const stepNum  = i + 1
          const isDone   = stepNum < currentStep
          const isActive = stepNum === currentStep

          return (
            <div key={label} className="flex-1 flex flex-col gap-1">
              <div className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                isDone   ? 'bg-green-500' :
                isActive ? 'bg-blue-600'  : 'bg-slate-200'
              )} />
              <span className={cn(
                'text-[10px] font-medium text-center',
                isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-slate-400'
              )}>
                {isDone ? '✓' : stepNum}. {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}