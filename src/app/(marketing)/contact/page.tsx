// src/app/(marketing)/contact/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Scissors, MessageCircle, Mail, MapPin, Phone, CheckCircle2 } from 'lucide-react'

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', subject:'', message:'' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production: send to your API / Formspree / EmailJS
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 py-4 max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/home" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={13} className="text-white" />
          </div>
          <span className="font-bold text-slate-700">Darzi Manager</span>
        </Link>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Get in Touch</h1>
          <p className="text-slate-500 max-w-lg mx-auto">
            Have a question or need help? We respond within 24 hours on business days.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">

          {/* Contact info */}
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6">Contact Information</h2>
            <div className="space-y-5">
              {[
                { icon: MessageCircle, label:'WhatsApp', value:'+92 300 0000000', color:'text-green-600', bg:'bg-green-50' },
                { icon: Mail,          label:'Email',    value:'hello@darzimanager.pk', color:'text-blue-600', bg:'bg-blue-50' },
                { icon: Phone,         label:'Phone',    value:'+92 300 0000000', color:'text-purple-600', bg:'bg-purple-50' },
                { icon: MapPin,        label:'Location', value:'Lahore, Pakistan', color:'text-red-600', bg:'bg-red-50' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-4">
                  <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <c.icon size={18} className={c.color} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">{c.label}</p>
                    <p className="text-sm font-semibold text-slate-800">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <h3 className="font-bold text-blue-800 mb-2">Support Hours</h3>
              <p className="text-sm text-blue-700">Monday – Saturday: 9am – 6pm (PKT)</p>
              <p className="text-sm text-blue-700 mt-1">WhatsApp support available 7 days/week</p>
            </div>
          </div>

          {/* Contact form */}
          <div>
            {sent ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Message Sent!</h3>
                <p className="text-slate-500">We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { key:'name',    label:'Your Name',    type:'text',  placeholder:'Ahmed Khan'               },
                  { key:'email',   label:'Email Address',type:'email', placeholder:'ahmed@example.com'        },
                  { key:'subject', label:'Subject',      type:'text',  placeholder:'How can we help you?'     },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                                 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Message</label>
                  <textarea
                    placeholder="Tell us more..."
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    rows={5}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                               text-sm outline-none focus:border-blue-500 focus:bg-white
                               resize-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold
                             py-4 rounded-2xl transition-colors"
                >
                  Send Message →
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}