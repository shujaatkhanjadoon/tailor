// src/app/(marketing)/terms-of-service/page.tsx
import Link from 'next/link'
import { Scissors } from 'lucide-react'

const terms = [
  { title:'1. Acceptance of Terms', content:`By accessing or using Darzi Manager, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.` },
  { title:'2. Description of Service', content:`Darzi Manager provides a tailor shop management application for order tracking, customer management, measurement storage, and payment tracking. The service is available via web browser and as a Progressive Web App (PWA).` },
  { title:'3. Account Responsibilities', content:`You are responsible for maintaining the confidentiality of your PIN and for all activities under your account. You must notify us immediately of any unauthorized use of your account. You must provide accurate information when setting up your shop.` },
  { title:'4. Acceptable Use', content:`You agree not to use Darzi Manager for any unlawful purpose, to harm others, or to interfere with the service. You may not attempt to gain unauthorized access to any part of the system.` },
  { title:'5. Subscription & Payments', content:`Paid plans are billed monthly or annually in Pakistani Rupees. Subscriptions automatically renew unless cancelled. Refunds are available within 7 days of payment if the service has not been substantially used.` },
  { title:'6. Data & Content', content:`You retain ownership of all data you enter into Darzi Manager. You grant us a limited license to store and process this data solely to provide the service. We do not claim ownership of your business data.` },
  { title:'7. Service Availability', content:`We strive for 99% uptime but do not guarantee uninterrupted access. Darzi Manager is designed to work offline, so temporary outages should not interrupt your workflow. We are not liable for losses resulting from service unavailability.` },
  { title:'8. Termination', content:`You may stop using Darzi Manager at any time. You can delete all your data from the Settings page. We reserve the right to suspend accounts that violate these terms.` },
  { title:'9. Limitation of Liability', content:`Darzi Manager is provided "as is". We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our maximum liability is limited to the subscription fees paid in the last 3 months.` },
  { title:'10. Governing Law', content:`These terms are governed by the laws of Pakistan. Any disputes shall be resolved in the courts of Lahore, Pakistan.` },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 py-4 max-w-4xl mx-auto">
        <Link href="/home" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={13} className="text-white" />
          </div>
          <span className="font-bold text-slate-700">Darzi Manager</span>
        </Link>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-sm font-semibold text-blue-600 mb-2">Legal</p>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Terms of Service</h1>
        <p className="text-slate-500 mb-10">Last updated: April 2025</p>
        <div className="space-y-8">
          {terms.map(t => (
            <div key={t.title}>
              <h2 className="text-lg font-bold text-slate-800 mb-3">{t.title}</h2>
              <p className="text-slate-600 leading-relaxed">{t.content}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}