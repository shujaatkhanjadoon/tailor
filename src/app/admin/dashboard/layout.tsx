// src/app/admin/dashboard/layout.tsx
import { cookies }     from 'next/headers'
import { redirect }    from 'next/navigation'
import { verifySessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { AdminShell }  from '@/components/admin/AdminShell'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side auth check
  const cookieStore = await cookies()
  const token       = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!token || !verifySessionToken(token)) {
    redirect('/admin/login')
  }

  return <AdminShell>{children}</AdminShell>
}