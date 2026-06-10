// src/components/layout/ClientShell.tsx
'use client'

import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { Toaster } from "@/components/ui/sonner";
import { PageErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocaleProvider>
          <AppShell>
            <PageErrorBoundary>{children}</PageErrorBoundary>
          </AppShell>
        </LocaleProvider>
      </AuthProvider>
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  )
}
