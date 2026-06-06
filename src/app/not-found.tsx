export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🧵</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Page Nahi Mili</h1>
      <p className="text-slate-500 mb-6">Yeh page exist nahi karta. Shayed URL galat hai.</p>
      <a
        href="/"
        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Wapas Home
      </a>
    </div>
  )
}
