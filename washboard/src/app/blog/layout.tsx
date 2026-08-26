import Link from 'next/link'
import Image from 'next/image'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans">
      <nav className="sticky top-0 z-50 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-slate-900 dark:text-slate-100">WashBoard</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            Le blog
          </Link>
          <Link
            href="/signup"
            className="ml-auto px-3.5 py-1.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Essai gratuit
          </Link>
        </div>
      </nav>

      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-12 pb-20">
        {children}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Accueil</Link>
          <Link href="/blog" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Blog</Link>
          <Link href="/mentions-legales" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Mentions légales</Link>
          <Link href="/cgv" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">CGV</Link>
        </div>
      </footer>
    </div>
  )
}
