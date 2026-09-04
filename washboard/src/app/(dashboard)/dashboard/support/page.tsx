import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupportMember } from '@/lib/supportAccess'
import SupportAccessForm from '@/components/dashboard/SupportAccessForm'

export const dynamic = 'force-dynamic'

// Page réservée à l'équipe support : ouvrir une session sur le compte d'un
// laveur qui a demandé de l'aide.
//
// Elle n'apparaît dans aucun menu et renvoie vers l'accueil pour quiconque
// n'est pas dans SUPPORT_ADMIN_EMAILS — un laveur qui devinerait l'adresse ne
// doit pas même savoir qu'elle existe.
//
// Volontairement sans la coque du tableau de bord : celle-ci suppose une fiche
// laveur, alors qu'un membre du support n'en a pas forcément. Aujourd'hui
// l'adresse support est aussi celle d'un compte laveur, mais lier les deux
// interdirait de créer un jour un compte support dédié — et l'erreur se
// serait manifestée par une redirection vers la connexion, impossible à
// comprendre.
export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors mb-6"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Retour au tableau de bord
        </Link>

        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Support</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
          Accéder au compte d&apos;un laveur qui a ouvert l&apos;accès depuis ses réglages.
          Connecté en tant que {user.email}.
        </p>

        <SupportAccessForm />
      </div>
    </div>
  )
}
