'use client'

export function AppFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`px-4 pb-3 pt-4 text-center text-xs text-slate-400 ${className}`}>
      © {new Date().getFullYear()} MeraDarzi • Made with ❤️ for Pakistan 🇵🇰
    </footer>
  )
}
