import type { Metadata } from 'next'
import Link from 'next/link'
import { Heart, Shield, Zap, Users, Scissors, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'My Darzi ke baare mein — Pakistan ka pehla tailor management app.',
}

export default function AboutPage() {
  return (
    <div className="pt-16">

      {/* Hero */}
      <div className="bg-linear-to-br from-slate-900 to-blue-950 py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center
                          justify-center mx-auto mb-6 shadow-2xl shadow-blue-900/50">
            <Scissors size={36} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-5">
            Pakistan Ka Darzi App
          </h1>
          <p className="text-blue-200 text-xl max-w-2xl mx-auto leading-relaxed">
            Hum ek choti si team hain jo believe karte hain ke technology
            language ya budget ki wajah se kisi ke liye rokawat nahi banni chahiye.
          </p>
        </div>
      </div>

      {/* Story */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-black text-slate-900 mb-6">
                Hamari Kahani
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  Pakistan mein hazaron tailor shops hain jo aaj bhi orders ko
                  diary mein likhte hain, measurements ko copy par store karte hain,
                  aur payments ka hisaab mentally rakhte hain.
                </p>
                <p>
                  Hum ne dekha ke jab koi gahak order karta hai, tailor ko yaad rakhna
                  padta hai — kaun sa kapra, kaunsi nap, kab tayyar hoga, kitna diya.
                  Agar ek se zyada karigar hain, to aur bhi mushkil.
                </p>
                <p className="font-semibold text-slate-800">
                  My Darzi is problem ka solution hai. Ek simple app jo tailor ki
                  zindagi aasan kare — bina complicated training ke, bina internet
                  ki zaroorat ke, aur bilkul free shuru karne ke liye.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Heart,  title: 'User-First',  desc: 'Har feature simplicity ke liye', color: 'bg-red-50 text-red-600'    },
                { icon: Shield, title: 'Secure',       desc: 'Aapka data hamesha safe',        color: 'bg-blue-50 text-blue-600'  },
                { icon: Zap,    title: 'Fast',          desc: 'Purane phones par bhi fast',     color: 'bg-amber-50 text-amber-600'},
                { icon: Users,  title: 'For All',       desc: 'Solo se liye bade shops tak',   color: 'bg-green-50 text-green-600'},
              ].map(v => (
                <div key={v.title} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <div className={`w-10 h-10 rounded-xl flex items-center
                                  justify-center mb-3 ${v.color}`}>
                    <v.icon size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm mb-1">{v.title}</h3>
                  <p className="text-slate-500 text-xs">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: '500+',   label: 'Shops'         },
            { value: '25,000+',label: 'Orders'        },
            { value: '14',     label: 'Din Free Trial'},
            { value: '0%',     label: 'Raast Fee'     },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-black text-white mb-1">{s.value}</p>
              <p className="text-blue-200 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white text-center px-4">
        <h2 className="text-3xl font-black text-slate-900 mb-4">
          Sath Chalein?
        </h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          Aaj hi shuru karein — 14 din free trial, koi card nahi chahiye.
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-blue-600 text-white
                     font-bold px-10 py-4 rounded-2xl hover:bg-blue-700 transition-all"
        >
          Free Trial Shuru Karein <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  )
}