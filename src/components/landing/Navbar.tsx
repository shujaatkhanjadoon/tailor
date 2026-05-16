// src/components/landing/Navbar.tsx
'use client'

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { Scissors, Menu, X }   from 'lucide-react'
import { cn }                  from '@/lib/utils'

const NAV_LINKS = [
  { href: '/#features',    label: 'Features'    },
  { href: '/#how-it-works',label: 'How It Works'},
  { href: '/#pricing',     label: 'Pricing'     },
  { href: '/#faq',         label: 'FAQ'         },
  { href: '/about',        label: 'About'       },
  { href: '/contact',      label: 'Contact'     },
]

export function Navbar() {
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [scrolled,   setScrolled]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled
        ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100'
        : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center
                            justify-center shadow-lg shadow-blue-600/25">
              <Scissors size={18} className="text-white" strokeWidth={1.8} />
            </div>
            <span className="text-lg font-bold text-slate-900">Meradarzi</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600
                           rounded-lg hover:bg-blue-50 transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm font-semibold text-slate-700 hover:text-blue-600
                         px-4 py-2 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/auth"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
                         px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/25
                         hover:shadow-blue-600/40 active:scale-95"
            >
              Free Shuru Karein →
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="lg:hidden w-10 h-10 flex items-center justify-center
                       rounded-xl bg-slate-100 text-slate-700"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 py-4 space-y-1">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-slate-700
                           hover:bg-slate-50 rounded-xl transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 px-4 flex flex-col gap-2">
              <Link
                href="/auth"
                className="w-full text-center bg-blue-600 text-white font-bold
                           py-3.5 rounded-xl text-sm"
              >
                Free Shuru Karein →
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}