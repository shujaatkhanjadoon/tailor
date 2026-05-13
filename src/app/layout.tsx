// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { Toaster } from "@/components/ui/sonner";
import { PageErrorBoundary } from "@/components/ui/ErrorBoundary";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DarziHub",
    template: "%s | DarziHub",
  },
  description:
    "Pakistan ka pehla tailor management app â€” orders, measurements, payments. Offline bhi kaam kare.",
  keywords: ["tailor", "darzi", "pakistan", "order management", "kapra"],
  openGraph: {
    title: "DarziHub",
    description: "Pakistan ka pehla tailor management app",
    url: "https://mydarzi.vercel.app",
    siteName: "DarziHub",
    locale: "ur_PK",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DarziHub",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32" },
      { url: "/icons/icon-96.png", sizes: "96x96" },
      { url: "/icons/icon-192.png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/icon-152.png", sizes: "152x152" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${poppins.variable} min-w-0 overflow-x-clip font-sans antialiased`}
      >
        <AuthProvider>
          <OfflineBanner />
          <AppShell>
            <PageErrorBoundary>{children}</PageErrorBoundary>
          </AppShell>
        </AuthProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
