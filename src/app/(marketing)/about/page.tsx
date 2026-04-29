// src/app/(marketing)/about/page.tsx
import Link    from 'next/link'
import { Scissors, Heart, Shield, Zap, Users, Globe, ArrowRight } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center
                      justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scissors size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">DarziHub</span>
        </Link>
        <Link
          href="/auth"
          className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl"
        >
          Get Started Free
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200
                        text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          ðŸ‡µðŸ‡° Made in Pakistan, for Pakistan
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
          DarziHub ke baare mein
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Hum Pakistan ke chote aur medium tailor shops ke liye ek simple,
          powerful management tool bana rahe hain â€” jo offline bhi kaam kare
          aur har kisi ke liye easy ho.
        </p>
      </section>

      {/* Story */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            Hamari Kahani
          </h2>
          <div className="prose prose-slate max-w-none space-y-5 text-slate-600 leading-relaxed">
            <p className="text-lg">
              Pakistan mein hazaron tailor shops hain jo aaj bhi orders ko
              diary mein likhte hain, measurements ko copy par store karte hain,
              aur payments ka hisaab mentally rakhte hain.
            </p>
            <p>
              Hum ne dekha ke jab koi gahak order karta hai, tailor ko yaad rakhna
              padta hai â€” kaun sa kapra, kaunsi nap, kab tayyar hoga, kitna diya,
              kitna baaki hai. Agar ek se zyada karigar hain, to aur bhi mushkil.
            </p>
            <p>
              DarziHub is problem ka solution hai. Ek simple app jo tailor
              ki zindagi aasan kare â€” bina complicated training ke, bina internet
              ki zaroorat ke, aur bina kisi cost ke shuru karne ke liye.
            </p>
            <p className="font-semibold text-slate-800">
              Hamara mission: Pakistan ke har tailor ko digital tools dena
              jo pehle sirf bade businesses ke paas hote the.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-14">
          Hamari Values
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon:  Heart,
              color: 'bg-red-100 text-red-600',
              title: 'User-First Design',
              desc:  'Har feature is soch ke banate hain ke jo tailor diary use karta hai woh bhi asaani se use kar sake. Simplicity hamari priority hai.',
            },
            {
              icon:  Shield,
              color: 'bg-blue-100 text-blue-600',
              title: 'Data Safety',
              desc:  'Aapka data aapka hai. Hum sirf storage provide karte hain â€” kabhi sell nahi karte, kabhi share nahi karte. Offline-first matlab aapka data hamesha aapke paas.',
            },
            {
              icon:  Zap,
              color: 'bg-amber-100 text-amber-600',
              title: 'Fast & Lightweight',
              desc:  'Purane Android phones par bhi fast kaam kare. Low-end devices, slow internet â€” sab ka socha hai. PWA install ho jaye aur offline bhi chale.',
            },
            {
              icon:  Users,
              color: 'bg-green-100 text-green-600',
              title: 'For Every Tailor',
              desc:  'Solo tailor se le kar badi dukaan tak â€” DarziHub sab ke liye hai. Free plan hamesha free rahega.',
            },
            {
              icon:  Globe,
              color: 'bg-purple-100 text-purple-600',
              title: 'Pakistan-Centric',
              desc:  'Raast payments, Roman Urdu interface, Pakistani garment types, local WhatsApp integration â€” sab kuch Pakistan ke liye.',
            },
            {
              icon:  Scissors,
              color: 'bg-teal-100 text-teal-600',
              title: 'Always Improving',
              desc:  'Har hafte naye features. User feedback se product banate hain. Aap ka suggestion hamara next feature hoga.',
            },
          ].map(v => (
            <div key={v.title} className="text-center">
              <div className={`w-14 h-14 ${v.color} rounded-2xl flex items-center
                              justify-center mx-auto mb-4`}>
                <v.icon size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-3">{v.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '100%', label: 'Offline Support'    },
              { value: 'Free', label: 'Starter Plan'       },
              { value: '14',   label: 'Din Free Trial'     },
              { value: '0%',   label: 'Raast Transaction Fee' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-4xl font-bold text-white mb-1">{s.value}</p>
                <p className="text-blue-200 text-sm font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">Ek Chhoti Si Team</h2>
        <p className="text-slate-500 leading-relaxed mb-8">
          Hum ek passionate team hain jo believe karte hain ke technology
          language, literacy, ya budget ki wajah se kisi ke liye rokawat
          nahi banni chahiye. Pakistan ke tailors deserve karte hain
          woh tools jo unhe successful banayein.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <p className="text-slate-600 text-sm leading-relaxed italic">
            "Hum ne apne mohalle ke darzi chacha ko dekha jo roz subah
            uthke orders ka hisaab lagata tha, measurement cards dhundta tha,
            aur gahakoon ke calls par bata bata ke thak jata tha.
            DarziHub unhi jaise logon ke liye hai."
          </p>
          <p className="text-slate-400 text-xs mt-3 font-medium">â€” DarziHub Team</p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-16 text-center px-6">
        <h2 className="text-3xl font-bold text-white mb-3">
          Sath Chalein?
        </h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          Aaj hi shuru karein â€” 14 din free, koi card nahi chahiye.
          Aapke gahak khush, aap tension-free.
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-blue-600 text-white
                     font-bold px-10 py-4 rounded-2xl hover:bg-blue-700 transition-colors"
        >
          Free Trial Shuru Karein <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        <div className="flex items-center justify-center gap-6 mb-3">
          {[
            ['Privacy Policy', '/privacy-policy'],
            ['Terms of Service', '/terms-of-service'],
            ['Contact', '/contact'],
            ['Pricing', '/pricing'],
          ].map(([label, href]) => (
            <Link key={href} href={href}
              className="hover:text-slate-600 transition-colors">
              {label}
            </Link>
          ))}
        </div>
        © {new Date().getFullYear()} DarziHub • Made with ❤️ for Pakistan 🇵🇰
      </footer>
    </div>
  )
}
