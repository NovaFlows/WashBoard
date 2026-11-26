import type { Metadata } from 'next'
import Link from 'next/link'
import { BarreActions, BOUTON_PRINCIPAL, CadreEntree, GaucheAccueil, TitreEntree } from '@/components/entree/Entree'

export const metadata: Metadata = {
  title: 'Hors ligne — WashBoard',
  robots: { index: false, follow: false },
}

// Route de l'application, vue rarement : au lancement sans réseau c'est `public/hors-ligne.html`
// que le service worker sert. Elle doit fonctionner sans aucune requête.
export default function HorsLignePage() {
  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/dashboard' }}>
      <div className="flex flex-col gap-5">
        <TitreEntree
          titre="Pas de connexion"
          sousTitre="Votre téléphone n’a plus de réseau. Les pages déjà consultées restent accessibles ; celle-ci demande une connexion."
        />
        <BarreActions>
          <Link href="/dashboard" className={`${BOUTON_PRINCIPAL} flex items-center justify-center`}>Revenir au tableau de bord</Link>
        </BarreActions>
      </div>
    </CadreEntree>
  )
}
