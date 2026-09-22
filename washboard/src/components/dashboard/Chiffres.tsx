'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import ChiffresV2, { type ChiffresBooking, type ChiffresEvent } from '@/components/dashboard/ChiffresV2'

// Point d'entrée de « Chiffres » — nouvelle destination de la refonte 2026
// (passe 5) qui fusionne l'ancien CRM et la Comptabilité en un seul écran à
// 3 onglets (Argent · Acquisition · Clients). Contrairement à ClientsView.tsx
// ou ClientProfileModal.tsx (mêmes URLs qu'avant, contenu qui bascule entre
// V1 et V2), cette route est ENTIÈREMENT NEUVE : elle n'existe dans aucun
// menu v1, donc il n'y a rien à « brancher » — le site (navigateur classique)
// n'a jamais de raison d'y arriver. Ce composant est le garde-fou qui le
// vérifie quand même : si quelqu'un tape /dashboard/chiffres depuis un
// navigateur classique (lien copié, favori...), on le renvoie vers l'écran
// CRM existant plutôt que de lui montrer un écran v2 — décision d'Alexandre,
// 2026-09-22 : v1 sur le site, v2 seulement dans la PWA installée, sans
// exception.
//
// Pas de classe CSS ici : `isPwaStandalone()` ne peut être lu qu'après le
// montage (aucun équivalent "cookie lu côté serveur" pour `display-mode`), et
// il faut distinguer « pas encore vérifié » de « vérifié, ce n'est pas la
// PWA » pour ne rediriger qu'une fois la certitude acquise — d'où cet état à
// trois valeurs plutôt que le booléen de `usePwaStandalone()` seul.
type Statut = 'verification' | 'pwa' | 'site'

type Props = {
  bookings: ChiffresBooking[]
  events: ChiffresEvent[]
  websiteHost?: string
  hasCompta: boolean
  comptaPlanLabel: string
  facturesCount: number
}

export default function Chiffres(props: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/crm')
  }, [statut, router])

  // Rien pendant la vérification (évite un flash de contenu v2 dans un
  // navigateur classique), rien non plus pendant la redirection.
  if (statut !== 'pwa') return null

  return <ChiffresV2 {...props} />
}
