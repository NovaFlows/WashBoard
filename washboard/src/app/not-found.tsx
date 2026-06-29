import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <img
          src="/LogoWashBoard.png"
          alt="WashBoard"
          className="w-36 h-36 object-contain mx-auto mb-6 opacity-90"
        />
        <p className="text-5xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">404</p>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Page introuvable</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Cette page n&apos;existe pas, ou le lien de réservation n&apos;est plus disponible.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}
