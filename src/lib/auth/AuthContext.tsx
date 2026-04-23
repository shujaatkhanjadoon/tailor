// src/lib/auth/AuthContext.tsx
'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef, ReactNode,
} from 'react'
import { db, TeamMemberRecord } from '../db/schema'
import { teamOps, shopOps } from '../db/operations'

interface AuthState {
  isLoading:    boolean
  isSetupDone:  boolean
  currentUser:  TeamMemberRecord | null
  shopId:       string | null
  isOwner:      boolean
  isKarigar:    boolean
}

interface AuthActions {
  login:      (phone: string, pin: string) => Promise<boolean>
  logout:     () => void
  setupShop:  (shopName: string, ownerPhone: string, pin: string, ownerName?: string) => Promise<void>
  clearAllData: () => Promise<void>
}

type AuthContextType = AuthState & AuthActions
const AuthContext = createContext<AuthContextType | null>(null)
const SESSION_KEY = 'darzi_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isSetupDone: false,
    currentUser: null,
    shopId: null,
    isOwner: false,
    isKarigar: false,
  })

  // Restore session
  useEffect(() => {
    const restore = async () => {
      try {
        const shopId = await shopOps.getShopId()
        if (!shopId) {
          setState(s => ({ ...s, isLoading: false, isSetupDone: false }))
          return
        }
        const sessionRaw = localStorage.getItem(SESSION_KEY)
        if (sessionRaw) {
          const { memberId } = JSON.parse(sessionRaw)
          const member = await db.teamMembers.get(memberId)
          if (member?.isActive) {
            setState({
              isLoading: false, isSetupDone: true,
              currentUser: member, shopId,
              isOwner:   member.role === 'owner',
              isKarigar: member.role === 'karigar',
            })
            return
          }
        }
        setState(s => ({ ...s, isLoading: false, isSetupDone: true, shopId }))
      } catch {
        setState(s => ({ ...s, isLoading: false }))
      }
    }
    restore()
  }, [])

  const login = useCallback(async (phone: string, pin: string): Promise<boolean> => {
    const member = await teamOps.getByPhone(phone)
    if (!member || member.pin !== pin || !member.isActive) return false
    localStorage.setItem(SESSION_KEY, JSON.stringify({ memberId: member.id }))
    setState(s => ({
      ...s,
      currentUser: member,
      isOwner:   member.role === 'owner',
      isKarigar: member.role === 'karigar',
    }))
    return true
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setState(s => ({ ...s, currentUser: null, isOwner: false, isKarigar: false }))
  }, [])

  const setupShop = useCallback(async (
    shopName:   string,
    ownerPhone: string,
    pin:        string,
    ownerName?: string,
  ) => {
    // ── GUARD: prevent duplicate shop creation ──────────────────
    const existingShop = await db.shop.toCollection().first()
    if (existingShop) {
      console.warn('Shop already exists — skipping duplicate creation')
      // Just log in the existing owner
      const existingOwner = await db.teamMembers
        .where('phone').equals(ownerPhone).first()
      if (existingOwner) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ memberId: existingOwner.id }))
        const sId = await shopOps.getShopId()
        setState({
          isLoading: false, isSetupDone: true,
          currentUser: existingOwner, shopId: sId,
          isOwner: true, isKarigar: false,
        })
      }
      return
    }
    // ────────────────────────────────────────────────────────────

    const shopId = await shopOps.setup(shopName, ownerPhone)
    const owner  = await teamOps.add(shopId, {
      name:  ownerName || shopName + ' (Owner)',
      phone: ownerPhone,
      role:  'owner',
      pin,
    })
    localStorage.setItem(SESSION_KEY, JSON.stringify({ memberId: owner.id }))
    setState({
      isLoading: false, isSetupDone: true,
      currentUser: owner, shopId,
      isOwner: true, isKarigar: false,
    })
  }, [])

  const clearAllData = useCallback(async () => {
    await Promise.all([
      db.orders.clear(), db.customers.clear(),
      db.measurements.clear(), db.payments.clear(),
      db.orderStatusHistory.clear(), db.syncQueue.clear(),
      db.teamMembers.clear(), db.shop.clear(), db.appSettings.clear(),
    ])
    localStorage.clear()
    setState({
      isLoading: false, isSetupDone: false,
      currentUser: null, shopId: null,
      isOwner: false, isKarigar: false,
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setupShop, clearAllData }}>
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
    isOwner, isKarigar,
  }
}