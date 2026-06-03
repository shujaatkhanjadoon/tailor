// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Poppins, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { Toaster } from "@/components/ui/sonner";
import { PageErrorBoundary } from "@/components/ui/ErrorBoundary";

// Entire app is client-heavy for now — opt in per route as pages convert to Server Components
export const unstable_instant = false

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urdu",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mera Darzi - Best Tailor Management Software in Pakistan",
    template: "%s | Mera Darzi",
  },

  description:
    "Mera Darzi is Pakistan’s leading tailor management software for darzis and boutiques. Manage orders, customer measurements, payments, stitching records, and delivery tracking all in one app.",

  keywords: [
    "tailor management software",
    "darzi app pakistan",
    "boutique management system",
    "tailor shop software",
    "measurement management app",
    "stitching order management",
    "fashion boutique software",
    "customer measurement app",
    "tailor business pakistan",
    "meradarzi",
    "darzi software",
    "tailor POS system",
  ],

  openGraph: {
    title: "Mera Darzi - Pakistan’s #1 Tailor Management App",
    description:
      "Manage tailoring orders, customer measurements, payments, and delivery tracking with Mera Darzi — Pakistan’s modern tailoring management solution.",

    url: "https://app.meradarzi.pk",
    siteName: "Mera Darzi",
    locale: "en_PK",
    type: "website",
     images: [
      {
        url: '/og-images/MeraDarzi.jpg',
        width: 1200,
        height: 630,
        alt: 'Mera Darzi',
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Mera Darzi - Tailor Management Software Pakistan",
    description:
      "All-in-one tailoring management system for darzis and boutiques in Pakistan.",
       images: ['/og-images/MeraDarzi.jpg'],
  },

  manifest: "/manifest.json",

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mera Darzi",
  },

  formatDetection: {
    telephone: false,
  },

  metadataBase: new URL("https://app.meradarzi.pk"),
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      "x-default": "/",
    },
  },

  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32" },
      { url: "/icon-96.png", sizes: "96x96" },
      { url: "/icon-192.png", sizes: "192x192" },
    ],
    apple: [{ url: "/icon-152.png", sizes: "152x152" }],
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
  // Server-rendered with Urdu as default; client-side LocaleProvider will
  // read localStorage and update dir/lang dynamically
  return (
    <html
      lang="ur"
      dir="rtl"
      data-scroll-behavior="smooth"
      className="locale-ur"
    >
      <body
        className={`${poppins.variable} ${notoNastaliqUrdu.variable} min-w-0 overflow-x-clip font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <LocaleProvider>
            <AppShell>
              <PageErrorBoundary>{children}</PageErrorBoundary>
            </AppShell>
          </LocaleProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
