import type { Metadata }  from 'next'
import { Mail, MessageCircle, MapPin, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'My Darzi support se contact karein.',
}

export default function ContactPage() {
  return (
    <div className="pt-16 min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">

        <div className="text-center mb-14">
          <h1 className="text-4xl font-black text-slate-900 mb-4">Contact Us</h1>
          <p className="text-slate-500 text-lg">
            Koi bhi sawal ho — hum yahan hain
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">

          {/* Contact info */}
          <div className="lg:col-span-2 space-y-4">
            {[
              {
                icon:  MessageCircle,
                title: 'WhatsApp',
                value: process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '+92 300 0000000',
                href:  `https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? '923000000000'}?text=Assalam%20o%20Alaikum`,
                color: 'bg-green-100 text-green-600',
                desc:  'Fastest response',
              },
              {
                icon:  Mail,
                title: 'Email',
                value: 'support@mydarzi.app',
                href:  'mailto:support@mydarzi.app',
                color: 'bg-blue-100 text-blue-600',
                desc:  'Within 24 hours',
              },
              {
                icon:  Clock,
                title: 'Support Hours',
                value: 'Mon–Sat, 9am–6pm PKT',
                href:  null,
                color: 'bg-amber-100 text-amber-600',
                desc:  'Pakistan Standard Time',
              },
              {
                icon:  MapPin,
                title: 'Location',
                value: 'Pakistan 🇵🇰',
                href:  null,
                color: 'bg-purple-100 text-purple-600',
                desc:  'Serving all Pakistan',
              },
            ].map(c => (
              <div key={c.title}
                className="bg-white rounded-2xl p-5 border border-slate-200 flex gap-4">
                <div className={`w-11 h-11 rounded-2xl flex items-center
                                justify-center shrink-0 ${c.color}`}>
                  <c.icon size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{c.title}</p>
                  {c.href ? (
                    <a href={c.href} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline font-medium">
                      {c.value}
                    </a>
                  ) : (
                    <p className="text-slate-600 text-sm font-medium">{c.value}</p>
                  )}
                  <p className="text-slate-400 text-xs mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="lg:col-span-3 bg-white rounded-3xl p-7 border border-slate-200 shadow-sm">
            <h2 className="font-bold text-slate-800 text-xl mb-6">Message Bhejein</h2>
            <form className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {['Your Name', 'Your Email'].map((label, i) => (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-slate-500
                                       uppercase tracking-wide mb-1.5">
                      {label}
                    </label>
                    <input
                      type={i === 1 ? 'email' : 'text'}
                      placeholder={i === 0 ? 'Ahmed Bhai' : 'ahmed@gmail.com'}
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200
                                 rounded-xl text-sm outline-none focus:border-blue-500
                                 focus:bg-white transition-all"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500
                                   uppercase tracking-wide mb-1.5">
                  Subject
                </label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200
                                   rounded-xl text-sm outline-none focus:border-blue-500
                                   focus:bg-white transition-all">
                  {[
                    'Technical Support',
                    'Billing / Payment',
                    'Feature Request',
                    'Bug Report',
                    'General Inquiry',
                  ].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500
                                   uppercase tracking-wide mb-1.5">
                  Message
                </label>
                <textarea
                  rows={5}
                  placeholder="Apna sawal ya masla likhein..."
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200
                             rounded-xl text-sm outline-none focus:border-blue-500
                             focus:bg-white transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold
                           py-3.5 rounded-xl text-sm transition-all active:scale-[0.98]"
              >
                Send Message ✓
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}