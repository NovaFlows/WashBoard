'use client'

import FeuillePrestationV2 from '@/components/dashboard/FeuillePrestationV2'
import { formulaireDepuisService } from '@/lib/prestationForm'
import type { Service, ServiceCategory } from '@/types'

/** Fiche d'une prestation d'un laveur à deux centres, sur données fictives (banc d'essai local). */
const categorie: ServiceCategory = {
  id: 'cars', washer_id: 'w', name: 'Voitures', display_order: 0,
  types: [{ id: 'citadine', name: 'Citadine' }, { id: 'berline', name: 'Berline' }],
}
const service: Service = {
  id: 's1', washer_id: 'w', category_id: 'cars', name: 'Extérieur', description: null, price: 35, duration_minutes: 60,
  vehicle_types: ['citadine', 'berline'], vehicle_price_overrides: {}, addons: [],
}

export default function FeuillePrestationDemo() {
  return (
    <FeuillePrestationV2
      service={service}
      formulaireInitial={formulaireDepuisService(service)}
      categories={[categorie]}
      services={[service]}
      availabilities={[]}
      lieuxMixtes
      centresProposes={[
        { id: 'a1', nom: 'Nord', adresse: '8 avenue Foch, 69006 Lyon' },
        { id: 'b2', nom: 'Sud', adresse: '3 rue du Port, 13002 Marseille' },
      ]}
      onEnregistrer={async form => { (window as unknown as { __prestationEnregistree?: unknown }).__prestationEnregistree = form; return null }}
      onClose={() => {}}
    />
  )
}
