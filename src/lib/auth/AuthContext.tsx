// src/lib/auth/AuthContext.tsx
'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef, ReactNode,
} from 'react'
import { db, TeamMemberRecord } from '../db/schema'
import { teamOps, shopOps }     from '../db/operations'
import { supabase } from '../supabase/client'

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
  setupShop:    (shopName: string, ownerPhone: string, pin: string, ownerName?: string) => Promise<void>
  reinitialize: () => Promise<void>   // ← re-reads DB after Supabase pull
  clearAllData: () => Promise<void>
}

type AuthContextType = AuthState & AuthActions
const AuthContext = createContext<AuthContextType | null>(null)
const SESSION_KEY = 'darzi_session'

// ── Core: read current auth state from IndexedDB ──────────────────
async function readStateFromDB(): Promise<Partial<AuthState>> {
  try {
    const shopId = await shopOps.getShopId()
    if (!shopId) {
      return { isSetupDone: false, shopId: null, currentUser: null }
    }

    const sessionRaw = localStorage.getItem(SESSION_KEY)
    if (sessionRaw) {
      const { memberId } = JSON.parse(sessionRaw)
      const member = await db.teamMembers.get(memberId)
      if (member?.isActive) {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading:   true,
    isSetupDone: false,
    currentUser: null,
    shopId:      null,
    isOwner:     false,
    isKarigar:   false,
  })

  // Restore session on mount
  useEffect(() => {
    readStateFromDB().then(partial => {
      setState(s => ({
        ...s,
        ...partial,
        isLoading: false,
      }))
    })
  }, [])

  // Re-reads DB — call this after pulling from Supabase
  const reinitialize = useCallback(async () => {
    const partial = await readStateFromDB()
    setState(s => ({
      ...s,
      ...partial,
      isLoading: false,
    }))
  }, [])

  const login = useCallback(async (phone: string, pin: string): Promise<boolean> => {
    const member = await teamOps.getByPhone(phone)
    if (!member || member.pin !== pin || !member.isActive) return false

    localStorage.setItem(SESSION_KEY, JSON.stringify({ memberId: member.id }))
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

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setState(s => ({
      ...s,
      currentUser: null,
      isOwner:     false,
      isKarigar:   false,
    }))
  }, [])

  const setupShop = useCallback(async (
    shopName:   string,
    ownerPhone: string,
    pin:        string,
    ownerName?: string,
  ) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Naya account banane ke liye internet chahiye')
    }

    // Prevent duplicate shops
    const existing = await db.shop.toCollection().first()
    if (existing) {
      console.warn('[Auth] Shop exists — skipping')
      return   // Don't call reinitialize — let auth page handle redirect
    }

    const shopId = await shopOps.setup(shopName, ownerPhone)
    const owner  = await teamOps.add(shopId, {
      name:  ownerName || shopName,
      phone: ownerPhone,
      role:  'owner',
      pin,
    })

    localStorage.setItem(SESSION_KEY, JSON.stringify({ memberId: owner.id }))

    // Update state directly — don't call reinitialize (causes loop)
    setState({
      isLoading:   false,
      isSetupDone: true,
      currentUser: owner,
      shopId,
      isOwner:     true,
      isKarigar:   false,
    })
  }, [])

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

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const usePermission = () => {
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