import type { Metadata }  from 'next'
import { Navbar }         from '@/components/landing/Navbar'
import { Footer }         from '@/components/landing/Footer'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://mydarzi.vercel.app'),
  title: {
    default:  'DarziHub — Pakistan Ka Smart Tailor Management App',
    template: '%s | DarziHub',
  },
  description:
    'Orders track karein, customers manage karein, payments record karein. ' +
    'Pakistan ka pehla offline-first tailor management app. Free shuru karein.',
  keywords: ['tailor', 'darzi', 'pakistan', 'order management', 'kapra', 'stitching'],
  openGraph: {
    siteName: 'DarziHub',
    locale:   'ur_PK',
    type:     'website',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}