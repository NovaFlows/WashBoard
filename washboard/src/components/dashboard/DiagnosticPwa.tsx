'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { isPwaStandalone } from '@/lib/pwaStandalone'

// Ligne de diagnostic discrète au bas de l'écran « Plus » de la PWA : la version
// réellement chargée par le téléphone, et ce qu'il détecte de lui-même.
//
// Ajoutée le 2026-09-24 parce qu'on ne pouvait pas savoir, depuis l'extérieur,
// si un écran d'iPhone montrait le dernier déploiement (une PWA rouverte reste
// souvent en mémoire) ou une vraie différence de comportement. Trois valeurs :
//   · version : empreinte du commit construit (voir `next.config.ts`) ;
//   · mode appli : `isPwaStandalone()`, le test que la barre du bas utilise ;
//   · classe wb-pwa : ce que le script posé avant la première peinture a
//     trouvé, et dont dépend le retrait de l'en-tête (globals.css).
// Si les deux dernières divergent, c'est le bug.
//
// `useSyncExternalStore` plutôt qu'un effet : lecture du navigateur sans
// désaccord d'hydratation (valeur serveur neutre, puis la vraie côté client).
const rien = () => () => {}

function lire() {
  return JSON.stringify({
    appli: isPwaStandalone(),
    classe: document.documentElement.classList.contains('wb-pwa'),
  })
}

export function DiagnosticPwa() {
  const brut = useSyncExternalStore(rien, lire, () => '')
  const etat = brut ? (JSON.parse(brut) as { appli: boolean; classe: boolean }) : null
  const oui = (v: boolean) => (v ? 'oui' : 'non')
  // Accès équipe : ce que le serveur répond pour CE compte (voir `api/support/est-equipe`).
  const [equipe, setEquipe] = useState<{ membre: boolean; compte: string | null; listeConfiguree: boolean } | null>(null)
  useEffect(() => {
    let annule = false
    fetch('/api/support/est-equipe')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!annule && j && typeof j.membre === 'boolean') setEquipe(j) })
      .catch(() => {})
    return () => { annule = true }
  }, [])
  return (
    <p className="pb-2 text-center text-[11px] text-[color:var(--v2-color-gris)] tabular-nums opacity-70">
      v. {process.env.NEXT_PUBLIC_BUILD_SHA}
      {etat && <> · mode appli : {oui(etat.appli)} · classe wb-pwa : {oui(etat.classe)}</>}
      {equipe && <><br />compte : {equipe.compte ?? '?'} · équipe : {oui(equipe.membre)} · liste du déploiement : {equipe.listeConfiguree ? 'définie' : 'ABSENTE'}</>}
    </p>
  )
}
