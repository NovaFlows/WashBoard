'use client'

import FeuilleCentreAutoV2 from '@/components/dashboard/FeuilleCentreAutoV2'

/** Feuille « Centre auto » sur données fictives (banc d'essai local). `multi` : deux centres. */
export default function CentreAutoDemo({ multi = false }: { multi?: boolean }) {
  const reglages = multi
    ? { actif: true, adresse: '8 avenue Foch, 69006 Lyon', lieux: 'les_deux' as const, centres: [
      { id: 'a1', nom: 'Nord', adresse: '8 avenue Foch, 69006 Lyon' },
      { id: 'b2', nom: 'Sud', adresse: '3 rue du Port, 13002 Marseille' },
    ] }
    : { actif: true, adresse: '8 avenue Foch, 69006 Lyon', lieux: 'les_deux' as const, centres: [] }
  return (
    <FeuilleCentreAutoV2
      reglages={reglages}
      adresseDeBase="12 rue Mercière, 69002 Lyon"
      onEnregistrer={async r => { (window as unknown as { __centreEnregistre?: unknown }).__centreEnregistre = r; return null }}
      onClose={() => {}}
    />
  )
}
