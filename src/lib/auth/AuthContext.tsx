// src/lib/auth/AuthContext.tsx
'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, ReactNode,
} from 'react'
import { db, TeamMemberRecord } from '../db/schema'
import { teamOps, shopOps }     from '../db/operations'
import { supabase }             from '../supabase/client'
import { hashPIN, verifyPIN }   from '@/lib/security/pin'

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
  ) => Promise<string>
  reinitialize: () => Promise<void>
  clearAllData: () => Promise<void>
}

type AuthContextType = AuthState & AuthActions

const AuthContext  = createContext<AuthContextType | null>(null)
const SESSION_KEY  = 'md_session_v2'
const SESSION_TTL  = 30 * 24 * 60 * 60 * 1000   // 30 days

// ── Session helpers ───────────────────────────────────────────────

function getSession(): { memberId: string; expiresAt?: number } | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (s.expiresAt && Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

function saveSession(memberId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    memberId,
    expiresAt: Date.now() + SESSION_TTL,
  }))
}

// ── Remote shop status check ──────────────────────────────────────

async function isRemoteShopActive(shopId: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.onLine) return true
  try {
    const { data, error } = await (supabase as any)
      .from('shops')
      .select('is_active')
      .eq('id', shopId)
      .maybeSingle()
    if (error || !data) return true
    return data.is_active !== false
  } catch {
    return true
  }
}

// ── Core: read auth state from IndexedDB ──────────────────────────

async function readStateFromDB(): Promise<Partial<AuthState>> {
  try {
    const shopId = await shopOps.getShopId()
    if (!shopId) return { isSetupDone: false, shopId: null, currentUser: null }

    const session = getSession()
    if (session?.memberId) {
      // Refresh TTL on active use
      saveSession(session.memberId)

      const member = await db.teamMembers.get(session.memberId)
      if (member?.isActive) {
        const active = await isRemoteShopActive(member.shopId)
        if (!active) {
          localStorage.removeItem(SESSION_KEY)
          await db.shop.update(member.shopId, { isActive: 0 }).catch(() => {})
          return { isSetupDone: true, shopId, currentUser: null }
        }
        return {
          isSetupDone: true,
          shopId,
          currentUser: member,
          isOwner:     member.role === 'owner',
          isKarigar:   member.role === 'karigar',
        }
      }
    }

    return { isSetupDone: true, shopId, currentUser: null }
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
    const member = await teamOps.getByPhone(phone)
    if (!member || !member.isActive) return false

    const valid = await verifyPIN(pin, member.pin)
    if (!valid) return false

    const active = await isRemoteShopActive(member.shopId)
    if (!active) {
      localStorage.removeItem(SESSION_KEY)
      await db.shop.update(member.shopId, { isActive: 0 }).catch(() => {})
      return false
    }

    saveSession(member.id)
    const shopId = await shopOps.getShopId()

    setState(s => ({
      ...s,
      isSetupDone: true,
      shopId:      shopId ?? s.shopId,
      currentUser: member,
      isOwner:     member.role === 'owner',
      isKarigar:   member.role === 'karigar',
    }))
    return true
  }, [])

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
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
  ): Promise<string> => {

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Naya account banane ke liye internet chahiye')
    }

    // Check for existing local shop
    const existing = await db.shop.toCollection().first()
    if (existing) {
      console.warn('[Auth] Local shop already exists')
      await reinitialize()
      return existing.id
    }

    // Generate IDs
    const shopId = crypto.randomUUID()

    // Hash PIN
    let pinHash: string
    try {
      pinHash = await hashPIN(pin)
    } catch (e) {
      console.error('[Auth] bcrypt failed:', e)
      pinHash = pin   // fallback
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
        pinHash,
      }),
    })

    const apiData = await apiRes.json()
    if (!apiRes.ok) {
      throw new Error(apiData.error ?? 'Account creation failed on server')
    }

    const actualMemberId = apiData.memberId

    // ── Also save to IndexedDB for offline use ───────────────────
    await shopOps.setupWithId(shopId, shopName, ownerPhone)

    const owner = await teamOps.addWithId(shopId, actualMemberId, {
      name:  ownerName?.trim() || shopName + ' (Owner)',
      phone: ownerPhone,
      role:  'owner',
      pin:   pinHash,   // hashed
    })

    saveSession(owner.id)

    setState({
      isLoading:   false,
      isSetupDone: true,
      currentUser: owner,
      shopId,
      isOwner:     true,
      isKarigar:   false,
    })

    return shopId
  }, [reinitialize])

  // ── Clear All Data ───────────────────────────────────────────
  const clearAllData = useCallback(async () => {
    await Promise.all([
      db.orders.clear(),
      db.customers.clear(),
      db.measurements.clear(),
      db.payments.clear(),
      db.orderStatusHistory.clear(),
      db.syncQueue.clear(),
      db.teamMembers.clear(),
      db.shop.clear(),
      db.appSettings.clear(),
    ])
    localStorage.clear()
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