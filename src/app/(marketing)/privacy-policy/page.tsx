import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'My Darzi Privacy Policy — aapka data kaise protect hota hai.',
}

const LAST_UPDATED = 'May 13, 2026'

export default function PrivacyPolicyPage() {
  const sections = [
    {
      title: '1. Information We Collect',
      content: `We collect information you provide directly to us:
      
- Account information: Name, phone number, email address, shop name
- Business data: Orders, customers, measurements, payments (stored securely)
- Device information: Device type, operating system (for app optimization)
- Usage data: Features used, error logs (to improve the app)

We do NOT collect: Payment card details, government IDs, or any sensitive personal information beyond what is necessary for the service.`,
    },
    {
      title: '2. How We Use Your Information',
      content: `Your information is used solely to:

- Provide and maintain the My Darzi service
- Sync your data across devices (if cloud sync is enabled)
- Send important service notifications
- Improve app performance and fix bugs
- Respond to your support requests

We NEVER sell, rent, or share your data with third parties for advertising or commercial purposes.`,
    },
    {
      title: '3. Data Storage & Security',
      content: `Your data is stored on Supabase servers (AWS Singapore region). We implement:

- End-to-end encryption for data in transit
- AES-256 encryption for data at rest
- Regular security audits
- Row-level security policies (your data is isolated from other shops)
- PIN-based authentication with bcrypt hashing`,
    },
    {
      title: '4. Offline Data',
      content: `My Darzi stores data locally on your device (IndexedDB) for offline functionality. This local data:

- Remains on your device until you clear app data
- Is synced to our servers when internet is available
- Is your property — you can delete it anytime via Settings`,
    },
    {
      title: '5. Data Retention',
      content: `We retain your data for as long as your account is active. If you delete your account:

- All your data is permanently deleted within 30 days
- Backups are purged within 90 days
- We cannot recover deleted data after confirmation`,
    },
    {
      title: '6. Third-Party Services',
      content: `We use limited third-party services:

- Supabase: Database and authentication infrastructure
- Cloudinary: Photo storage (Business plan only)
- Resend: Email notifications
- Vercel: App hosting

Each service has its own privacy policy and we only share data necessary for functionality.`,
    },
    {
      title: '7. Your Rights',
      content: `You have the right to:

- Access your data (download via Settings)
- Correct inaccurate data
- Delete your account and all data
- Opt out of non-essential communications

Contact us at support@mydarzi.app to exercise these rights.`,
    },
    {
      title: '8. Children\'s Privacy',
      content: 'My Darzi is not intended for users under 13 years of age. We do not knowingly collect personal information from children.',
    },
    {
      title: '9. Changes to This Policy',
      content: 'We may update this Privacy Policy. We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance.',
    },
    {
      title: '10. Contact',
      content: 'For privacy concerns: support@mydarzi.app or WhatsApp: +92-313-5931459',
    },
  ]

  return (
    <div className="pt-16 min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4">
            Legal
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-3">Privacy Policy</h1>
          <p className="text-slate-500">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-8">
          <p className="text-blue-800 text-sm font-medium leading-relaxed">
            📋 <strong>Summary:</strong> We collect minimal data needed to run the service,
            never sell it, store it securely, and you can delete it anytime.
          </p>
        </div>

        <div className="space-y-8">
          {sections.map(s => (
            <div key={s.title}>
              <h2 className="text-xl font-bold text-slate-900 mb-3">{s.title}</h2>
              <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                {s.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}