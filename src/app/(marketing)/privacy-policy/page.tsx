// src/app/(marketing)/privacy-policy/page.tsx
import Link from 'next/link'
import { Scissors } from 'lucide-react'

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly to us when you create an account or use our services. This includes your shop name, phone number, and a 4-digit PIN. We also collect usage data to improve our service, such as feature usage frequency and error reports.`
  },
  {
    title: '2. How We Use Your Information',
    content: `We use your information solely to provide and improve the Darzi Manager service. Your data is used to sync your orders, customers, and measurements across devices, send you service notifications, and provide customer support. We do not sell your personal information to third parties.`
  },
  {
    title: '3. Data Storage & Security',
    content: `Your data is stored locally on your device using browser storage (IndexedDB). When online, data is synced to our secure cloud servers powered by Supabase with industry-standard encryption. Your PIN is stored as a hashed value and is never visible to our team.`
  },
  {
    title: '4. Data Sharing',
    content: `We do not share your personal information with third parties except as necessary to provide our services (e.g., cloud infrastructure providers). We may share anonymized, aggregated data for analytics purposes. We do not serve advertisements in our products.`
  },
  {
    title: '5. Your Rights',
    content: `You have the right to access, correct, or delete your personal data at any time. You can reset all data from the Settings page of the app. To request a complete data export or deletion, contact us at privacy@darzimanager.pk.`
  },
  {
    title: '6. Cookies',
    content: `We use minimal cookies necessary for app functionality, such as maintaining your login session. We do not use tracking or advertising cookies.`
  },
  {
    title: '7. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of significant changes via the app. Continued use of the service after changes constitutes acceptance of the updated policy.`
  },
  {
    title: '8. Contact',
    content: `For privacy-related inquiries, please contact us at privacy@darzimanager.pk or through our Contact page.`
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center gap-3 max-w-4xl mx-auto">
        <Link href="/home" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={13} className="text-white" />
          </div>
          <span className="font-bold text-slate-700">Darzi Manager</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="mb-10">
          <p className="text-sm font-semibold text-blue-600 mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Privacy Policy</h1>
          <p className="text-slate-500">Last updated: April 2025</p>
        </div>

        <p className="text-slate-600 leading-relaxed mb-8">
          At Darzi Manager, we take your privacy seriously. This policy explains what information
          we collect, how we use it, and your rights regarding your data.
        </p>

        <div className="space-y-8">
          {sections.map(s => (
            <div key={s.title}>
              <h2 className="text-lg font-bold text-slate-800 mb-3">{s.title}</h2>
              <p className="text-slate-600 leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}