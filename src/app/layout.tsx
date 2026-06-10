// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Poppins, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { ClientShell } from "@/components/layout/ClientShell";

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
    "Mera Darzi is Pakistan's leading tailor management software for darzis and boutiques. Manage orders, customer measurements, payments, stitching records, and delivery tracking all in one app.",
  keywords: [
    "tailor management software", "darzi app pakistan",
    "boutique management system", "tailor shop software",
    "measurement management app", "stitching order management",
    "fashion boutique software", "customer measurement app",
    "tailor business pakistan", "meradarzi", "darzi software", "tailor POS system",
  ],
  openGraph: {
    title: "Mera Darzi - Pakistan's #1 Tailor Management App",
    description:
      "Manage tailoring orders, customer measurements, payments, and delivery tracking with Mera Darzi — Pakistan's modern tailoring management solution.",
    url: "https://app.meradarzi.pk",
    siteName: "Mera Darzi",
    locale: "en_PK",
    type: "website",
    images: [{ url: '/og-images/MeraDarzi.jpg', width: 1200, height: 630, alt: 'Mera Darzi' }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mera Darzi - Tailor Management Software Pakistan",
    description: "All-in-one tailoring management system for darzis and boutiques in Pakistan.",
    images: ['/og-images/MeraDarzi.jpg'],
  },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mera Darzi" },
  formatDetection: { telephone: false },
  metadataBase: new URL("https://app.meradarzi.pk"),
  alternates: { canonical: "/", languages: { en: "/", "x-default": "/" } },
  icons: {
    icon: [
      { url: "/icon-72.png", sizes: "72x72" },
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
  return (
    <html
      lang="ur"
      dir="ltr"
      data-scroll-behavior="smooth"
      className="locale-ur"
      suppressHydrationWarning
    >
      <body
        className={`${poppins.variable} ${notoNastaliqUrdu.variable} min-w-0 overflow-x-clip font-sans antialiased`}
        suppressHydrationWarning
      >
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
