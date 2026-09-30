import type { Metadata } from 'next'
import VerifierEmail from './VerifierEmail'

export const metadata: Metadata = {
  title: 'Confirme ton email | WashBoard',
  robots: { index: false },
}

// L'adresse vient de l'URL (posée par /signup ou /login) et n'est ni vérifiée
// ni lue en base ici : les routes « renvoyer » et « recommencer » s'en chargent.
// Filtrée tout de même sur sa forme, pour qu'un lien fabriqué ne fasse pas
// afficher un texte arbitraire dans « Un email a été envoyé à … ».
//
// Sans adresse, la page affiche un lien vers /login plutôt que d'y rediriger :
// un compte connecté mais non confirmé serait renvoyé de /login vers
// /dashboard (voir `proxy.ts`), puis ici — une boucle.
export default async function VerifierEmailPage({ searchParams }: {
  searchParams: Promise<{ lien?: string | string[]; email?: string | string[] }>
}) {
  const { lien, email } = await searchParams
  const adresse = typeof email === 'string' ? email.trim() : ''
  const valide = adresse.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)

  return <VerifierEmail email={valide ? adresse : null} lienInvalide={lien === 'invalide'} />
}
