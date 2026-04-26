// src/lib/admin/session.ts
// 15-minute inactivity timeout for admin sessions
// Stores last activity in sessionStorage (cleared on tab close)

const TIMEOUT_MS  = 15 * 60 * 1000   // 15 minutes
const SESSION_KEY = 'admin_last_active'

export const adminSession = {
  // Record activity — call on every user interaction
  touch() {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(SESSION_KEY, String(Date.now()))
  },

  // Check if session is still valid
  isValid(): boolean {
    if (typeof window === 'undefined') return false
    const last = sessionStorage.getItem(SESSION_KEY)
    if (!last) return false
    return Date.now() - parseInt(last) < TIMEOUT_MS
  },

  // Milliseconds until timeout
  msUntilTimeout(): number {
    if (typeof window === 'undefined') return 0
    const last = sessionStorage.getItem(SESSION_KEY)
    if (!last) return 0
    return Math.max(0, TIMEOUT_MS - (Date.now() - parseInt(last)))
  },

  // Clear session
  clear() {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(SESSION_KEY)
  },

  // Initialize — record first activity
  init() {
    adminSession.touch()
  },
}