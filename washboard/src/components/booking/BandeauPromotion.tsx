'use client'

import { useEffect, useState } from 'react'
import { couleurTexteSur, libelleRemise, tempsRestant, type PromotionPublique } from '@/lib/promotion'

// Bandeau de promotion en haut de la page de réservation, réglé par le laveur
// (Plus › Promotions) : couleur, texte, compte à rebours. Disparaît de lui-même à la fin
// de la période, sans recharger la page.

const COULEUR_DEFAUT = '#16161A'

function deuxChiffres(n: number) {
  return String(n).padStart(2, '0')
}

export default function BandeauPromotion({ promo }: { promo: PromotionPublique }) {
  // Le compte à rebours ne se calcule que dans le navigateur : rendu côté serveur, l'heure
  // du serveur et celle du visiteur différeraient d'une seconde et React le signalerait.
  const [maintenant, setMaintenant] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- heure lue côté client uniquement (hydratation)
    setMaintenant(new Date())
    const t = setInterval(() => setMaintenant(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const reste = maintenant ? tempsRestant(promo.fin, maintenant) : undefined
  if (!promo.bandeau_actif || reste === null) return null

  const fond = promo.bandeau_couleur ?? COULEUR_DEFAUT
  const texte = couleurTexteSur(fond)

  return (
    <div role="region" aria-label="Promotion en cours" className="w-full" style={{ background: fond, color: texte }}>
      <div className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center">
        <p className="text-[14px] font-semibold leading-snug">
          {promo.nom} · {libelleRemise(promo)}
          {promo.bandeau_texte && <span className="font-normal opacity-90"> · {promo.bandeau_texte}</span>}
        </p>
        {promo.bandeau_compteur && (
          <p className="text-[13px] tabular-nums opacity-90" aria-live="off">
            {reste ? (
              <>
                Plus que{' '}
                {reste.jours > 0 && <>{reste.jours} j </>}
                {deuxChiffres(reste.heures)} h {deuxChiffres(reste.minutes)} min {deuxChiffres(reste.secondes)} s
              </>
            ) : <span className="invisible">Plus que 00 h 00 min 00 s</span>}
          </p>
        )}
      </div>
    </div>
  )
}
