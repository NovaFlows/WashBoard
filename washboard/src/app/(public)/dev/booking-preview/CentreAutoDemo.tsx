'use client'

import FeuilleCentreAutoV2 from '@/components/dashboard/FeuilleCentreAutoV2'

/** Feuille « Centre auto » sur données fictives (banc d'essai local). */
export default function CentreAutoDemo() {
  return <FeuilleCentreAutoV2 reglages={{ actif: true, adresse: '8 avenue Foch, 69006 Lyon', lieux: 'les_deux' }} adresseDeBase="12 rue Mercière, 69002 Lyon" onEnregistrer={async () => null} onClose={() => {}} />
}
