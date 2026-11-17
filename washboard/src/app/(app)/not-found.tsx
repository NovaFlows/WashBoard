import type { Metadata } from 'next'
import Link from 'next/link'
import Coque from '@/components/landing/vitrine/Coque'
import '@/components/landing/vitrine/base.css'
import '@/components/landing/vitrine/pages.css'

export const metadata: Metadata = {
  title: 'Page introuvable | WashBoard',
}

export default function NotFound() {
  return (
    <Coque>
      <div className="w nf">
        <p className="gros" aria-hidden="true">404</p>
        <h1 className="pg-h2">Page introuvable</h1>
        <p className="chapo">Cette page n&apos;existe pas, ou le lien de réservation n&apos;est plus disponible.</p>
        <div className="heros-cta">
          <Link href="/" className="btn btn-accent">Retour à l&apos;accueil</Link>
        </div>
      </div>
    </Coque>
  )
}
