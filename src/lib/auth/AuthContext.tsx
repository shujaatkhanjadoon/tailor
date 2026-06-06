// src/lib/auth/AuthContext.tsx
'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, ReactNode,
} from 'react'
import type { TeamMemberRecord } from '../db/schema'
import { hashPIN }   from '@/lib/security/pin'
import { mapTeamMember } from '@/lib/supabase/records'
// ── Types ─────────────────────────────────────────────────────────

interface AuthState {
  isLoading:   boolean
  isSetupDone: boolean
  currentUser: TeamMemberRecord | null
  shopId:      string | null
  isOwner:     boolean
  isKarigar:   boolean
}

interface AuthActions {
  login:        (phone: string, pin: string) => Promise<boolean>
  logout:       () => void
  setupShop:    (
    shopName:   string,
    ownerPhone: string,
    pin:        string,
    ownerName?: string,
    email?:     string,
    city?:      string,
    stateProvince?: string,
  ) => Promise<string>
  reinitialize: () => Promise<void>
  clearAllData: () => Promise<void>
}

type AuthContextType = AuthState & AuthActions

const AuthContext  = createContext<AuthContextType | null>(null)
const SESSION_KEY  = 'md_session_v2'

// ── Server session helpers ────────────────────────────────────────

async function readServerSession(): Promise<{
  memberId: string
  shopId: string
  member: Record<string, unknown>
  shopActive: boolean
} | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.authenticated) return null
    return { memberId: data.memberId, shopId: data.shopId, member: data.member, shopActive: data.shopActive !== false }
  } catch {
    return null
  }
}

async function createServerSession(memberId: string, shopId: string, pinHash?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ memberId, shopId, pinHash }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function deleteServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/session', {
      method: 'DELETE',
      credentials: 'include',
    })
  } catch {
    // non-fatal
  }
}

function setCachedShopId(shopId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify({ shopId }))
}

function clearCachedShopId(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

// ── Core: read auth state from server session ────────────────────

async function readStateFromDB(): Promise<Partial<AuthState>> {
  try {
    const serverSession = await readServerSession()
    if (serverSession) {
      const member = mapTeamMember(serverSession.member as any)
      if (member?.isActive) {
        if (!serverSession.shopActive) {
          await deleteServerSession()
          clearCachedShopId()
          return { isSetupDone: true, shopId: member.shopId, currentUser: null }
        }
        setCachedShopId(member.shopId)
        return {
          isSetupDone: true,
          shopId: member.shopId,
          currentUser: member,
          isOwner:   member.role === 'owner',
          isKarigar: member.role === 'karigar',
        }
      }
    }

    return { isSetupDone: false, shopId: null, currentUser: null }
  } catch {
    return { isSetupDone: false, shopId: null, currentUser: null }
  }
}

// ── Provider ──────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading:   true,
    isSetupDone: false,
    currentUser: null,
    shopId:      null,
    isOwner:     false,
    isKarigar:   false,
  })

  useEffect(() => {
    readStateFromDB().then(partial => {
      setState(s => ({ ...s, ...partial, isLoading: false }))
    })
  }, [])

  const reinitialize = useCallback(async () => {
    const partial = await readStateFromDB()
    setState(s => ({ ...s, ...partial, isLoading: false }))
  }, [])

  // ── Login ─────────────────────────────────────────────────────
  const login = useCallback(async (phone: string, pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ''), pin }),
      })
      if (!res.ok) return false
      const data = await res.json()
      if (!data.success) return false

      const partial = await readStateFromDB()
      setState(s => ({ ...s, ...partial, isLoading: false }))
      return true
    } catch {
      return false
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await deleteServerSession()
    clearCachedShopId()
    setState(s => ({
      ...s,
      currentUser: null,
      isOwner:     false,
      isKarigar:   false,
    }))
  }, [])

  // ── Setup Shop ───────────────────────────────────────────────
  const setupShop = useCallback(async (
    shopName:   string,
    ownerPhone: string,
    pin:        string,
    ownerName?: string,
    email?:     string,
    city?:      string,
    stateProvince?: string,
  ): Promise<string> => {

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Naya account banane ke liye internet chahiye')
    }

    // Generate IDs
    const shopId = crypto.randomUUID()

    // Hash PIN
    let pinHash: string
    try {
      pinHash = await hashPIN(pin)
    } catch (e) {
      console.error('[Auth] bcrypt failed:', e)
      throw new Error('PIN hash failed. Please try again.')
    }

    // ── Write to Supabase FIRST via server API ───────────────────
    // This ensures shop exists in DB before verification request
    const apiRes = await fetch('/api/auth/create-shop', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        shopId,
        shopName,
        ownerPhone,
        ownerName: ownerName?.trim() || shopName + ' (Owner)',
        email:     email?.toLowerCase().trim(),
        city:      city?.trim(),
        stateProvince: stateProvince?.trim(),
        pinHash,
      }),
    })

    const apiData = await apiRes.json()
    if (!apiRes.ok) {
      throw new Error(apiData.error ?? 'Account creation failed on server')
    }

    await createServerSession(apiData.memberId, shopId, pinHash)
    setCachedShopId(shopId)

    const partial = await readStateFromDB()
    setState(s => ({ ...s, ...partial, isLoading: false }))

    return shopId
  }, [])

  // ── Clear All Data ───────────────────────────────────────────
  const clearAllData = useCallback(async () => {
    await deleteServerSession()
    clearCachedShopId()
    setState({
      isLoading:   false,
      isSetupDone: false,
      currentUser: null,
      shopId:      null,
      isOwner:     false,
      isKarigar:   false,
    })
  }, [])

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      setupShop,
      reinitialize,
      clearAllData,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function usePermission() {
  const { isOwner, isKarigar } = useAuth()
  return {
    canViewPayments:  isOwner,
    canAddOrders:     isOwner,
    canDeleteOrders:  isOwner,
    canManageTeam:    isOwner,
    canAssignOrders:  isOwner,
    canUpdateStatus:  true,
    canViewAllOrders: isOwner,
    canViewOwnOrders: isKarigar,
    canViewCustomers: isOwner,
    isOwner,
    isKarigar,
  }
}
