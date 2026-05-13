import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund Policy',
}

export default function RefundPolicyPage() {
  return (
    <div className="pt-16 min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-green-100 text-green-700 text-xs font-bold
                          px-4 py-2 rounded-full mb-4">
            Legal
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-3">Refund Policy</h1>
          <p className="text-slate-500">Last updated: May 13, 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-10">
          <p className="text-green-800 font-bold text-sm">
            ✅ Fair Refund Policy: Agar aap santusht nahi hain to hum refund dete hain.
          </p>
        </div>

        <div className="space-y-8 text-slate-600 text-sm leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Free Plan</h2>
            <p>
              Starter (Free) plan ke liye koi payment nahi hoti, is liye refund
              applicable nahi.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">
              2. Paid Plans (Professional / Business)
            </h2>
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">
                  7-Day Money-Back Guarantee
                </h3>
                <p>
                  Pehle payment ke baad 7 din ke andar agar aap santusht nahi hain,
                  full refund milega. Koi sawal nahi.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">
                  Monthly Subscription
                </h3>
                <p>
                  7 din ke baad monthly subscription refund nahi hota.
                  Aap istema band kar ke agla renewal rok sakte hain.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">
                  Yearly Subscription
                </h3>
                <p>
                  Yearly plan ke liye 30 din ka refund window hai.
                  30 din ke baad pro-rata refund available nahi.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">
              3. Technical Issues
            </h2>
            <p>
              Agar hamare server issues ki wajah se aap 7+ din service use nahi
              kar sake, us period ka credit automatically diya jayega.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">
              4. How to Request a Refund
            </h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>WhatsApp ya email par contact karein</li>
              <li>Account phone number aur payment reference provide karein</li>
              <li>Refund 3-5 business days mein Raast ya bank transfer pe hoga</li>
            </ol>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Contact</h2>
            <p>
              Refund ke liye:{' '}
              <a href="mailto:support@mydarzi.app"
                className="text-blue-600 hover:underline">
                support@mydarzi.app
              </a>
              {' '}ya WhatsApp: {process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '+92 313 5931459'}
            </p>
          </div>
        </div>

        <div className="mt-10 bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="text-blue-800 text-sm font-medium">
            💬 Questions? <Link href="/contact" className="underline">Contact us</Link> —
            hum 24 ghante ke andar reply karenge.
          </p>
        </div>
      </div>
    </div>
  )
}