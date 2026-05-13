import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
}

export default function TermsPage() {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: `By creating an account or using My Darzi, you agree to these Terms. If you disagree, please do not use the service.`,
    },
    {
      title: '2. Description of Service',
      content: `My Darzi is a tailor management platform providing:
- Order and customer management
- Team (karigar) coordination
- Payment tracking
- Cloud data synchronization

We reserve the right to modify, suspend, or discontinue any part of the service.`,
    },
    {
      title: '3. Account Registration',
      content: `You must:
- Provide accurate information (real phone number, shop name)
- Be at least 18 years old
- Keep your PIN secure
- Not share your account with others
- Not create multiple accounts with the same phone number

One phone number = one account. Violations may result in account termination.`,
    },
    {
      title: '4. Acceptable Use',
      content: `You agree NOT to:
- Use the service for illegal activities
- Attempt to hack, scrape, or abuse the platform
- Share login credentials with others
- Create fake accounts or spam
- Reverse engineer the application`,
    },
    {
      title: '5. Subscription & Payments',
      content: `Paid plans (Professional, Business):
- Billed monthly or annually
- Payment via Raast (preferred) or bank transfer
- Manual verification by our team within 24 hours
- No automatic deductions — you initiate payment

Refunds: See our Refund Policy page.`,
    },
    {
      title: '6. Data Ownership',
      content: `You own your data. My Darzi:
- Does not claim ownership of your business data
- Stores it only to provide the service
- Will not access it without your permission (except for technical support you request)
- Will delete it upon account termination`,
    },
    {
      title: '7. Service Availability',
      content: `We aim for 99.9% uptime but cannot guarantee uninterrupted service. My Darzi is not liable for business losses due to:
- Server downtime
- Data sync delays
- Internet connectivity issues
- Force majeure events`,
    },
    {
      title: '8. Limitation of Liability',
      content: `My Darzi's total liability shall not exceed the amount you paid in the last 3 months. We are not liable for indirect, incidental, or consequential damages.`,
    },
    {
      title: '9. Termination',
      content: `We may terminate accounts that violate these terms. You may cancel anytime. Upon termination, your data will be deleted per our Privacy Policy.`,
    },
    {
      title: '10. Governing Law',
      content: `These terms are governed by the laws of Pakistan. Disputes shall be resolved in courts of Lahore, Pakistan.`,
    },
    {
      title: '11. Contact',
      content: `For terms-related questions: support@mydarzi.app`,
    },
  ]

  return (
    <div className="pt-16 min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-purple-100 text-purple-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4">
            Legal
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-3">
            Terms & Conditions
          </h1>
          <p className="text-slate-500">Last updated: May 13, 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
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
  )
}