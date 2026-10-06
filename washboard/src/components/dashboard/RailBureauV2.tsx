'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

// Rail de navigation — passe « châssis bureau » (2026-10-05, Alexandre, 2026-10-03). Ce que
// deviennent, sur grand écran, les 5 destinations de BarreBasV2.tsx + « Documents » épinglé :
// voir `washboard-design/maquettes/bureau-2026/index.html` (`.rail`) et son README (« Documents »
// épinglé sous les cinq, séparé par un filet). Monté par DashboardShell UNIQUEMENT quand
// `useDashboardV2()` ET `useGrandEcran()` sont vrais tous les deux : jamais sur le site en
// dessous de 1024px (où ClientsViewV1 etc. tournent encore), jamais dans la PWA sur téléphone
// (BarreBasV2 y reste — voir DashboardShell.tsx, `showBarreBas`/`showRailBureau`).
//
// Pas de `badgesOffre` (contrairement à Sidebar.tsx) : comme BarreBasV2, ce rail reste une
// liste de 5 destinations + 1 épinglée, jamais un sous-menu détaillé par fonctionnalité —
// chaque écran (Chiffres, Plus) sait déjà lui-même ce que son offre ne couvre pas
// (`OffreContext`), le rail n'a pas à le deviner en double.
//
// « Documents », comme « Chiffres » depuis la passe « Chiffres bureau » (2026-10-06), ne porte
// plus de distinction PWA/site depuis la passe « Documents bureau » (2026-10-07) : son
// garde-fou (Documents.tsx) montre désormais ce même écran au site sur grand écran avec
// `washer.beta_refonte` actif — exactement la condition qui affiche CE rail (`showRailBureau`
// dans DashboardShell.tsx = `useDashboardV2() && useEcranRail()`). Autrement dit, chaque fois
// que ce composant est monté, `/dashboard/chiffres/documents` montre déjà la v2, qu'on soit
// dans la PWA ou sur le site — plus besoin de distinguer les deux cas pour cette entrée non
// plus : avant cette passe, le rail pointait encore vers `/dashboard/factures` pour un laveur
// sur le site, ce qui aurait renvoyé vers l'écran v1 un laveur que `Documents.tsx` sait
// désormais accueillir en v2 (six pages orphelines inversé : une page JOIGNABLE mais dont le
// lien pointait ailleurs). Ce n'est pas vrai des trois autres (Aujourd'hui, Agenda, Clients,
// Plus) : mêmes adresses depuis toujours, leur contenu bascule déjà v1/v2 à l'intérieur de la
// page (ou reste v1 pour Aujourd'hui/Agenda/Plus, pas encore migrés — voir le rapport de la
// passe).
const police = '[font-family:var(--font-archivo)]'
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`

// Initiales d'avatar — même algorithme que ClientsViewV2.tsx / ParametresFormV2.tsx
// (dupliqué comme eux plutôt que partagé : une poignée de lignes de présentation, pas de
// la logique métier à centraliser).
function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

type Destination = {
  href: string
  label: string
  actif: (p: string) => boolean
  icone: React.ReactNode
}

// Icônes reprises du sprite de la maquette bureau (même style que BarreBasV2 : trait 1.8px,
// pas d'épaisseur qui change avec l'état actif — ici c'est le fond de la ligne qui porte
// l'état, voir `.rail-item.active` dans la maquette).
const ICONE_MAISON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </svg>
)
const ICONE_AGENDA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </svg>
)
const ICONE_CLIENTS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h3a4.5 4.5 0 0 1 4.5 4.5V20" />
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M17 14.2a4.5 4.5 0 0 1 3.5 4.3V20" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
  </svg>
)
const ICONE_CHIFFRES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 20V11M12 20V4M19 20v-7" />
  </svg>
)
const ICONE_PLUS_DESTINATION = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </svg>
)
const ICONE_DOCUMENT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5z" />
    <path d="M14 3.5V8h4" />
    <path d="M9 13h6M9 16.5h6" />
  </svg>
)

function destinations(): Destination[] {
  return [
    { href: '/dashboard', label: 'Aujourd’hui', actif: p => p === '/dashboard', icone: ICONE_MAISON },
    { href: '/dashboard/calendrier', label: 'Agenda', actif: p => p.startsWith('/dashboard/calendrier'), icone: ICONE_AGENDA },
    { href: '/dashboard/clients', label: 'Clients', actif: p => p.startsWith('/dashboard/clients'), icone: ICONE_CLIENTS },
    {
      href: '/dashboard/chiffres',
      label: 'Chiffres',
      actif: p =>
        (p.startsWith('/dashboard/chiffres') && !p.startsWith('/dashboard/chiffres/documents'))
        || p.startsWith('/dashboard/crm')
        || p.startsWith('/dashboard/compta'),
      icone: ICONE_CHIFFRES,
    },
    { href: '/dashboard/parametres', label: 'Plus', actif: p => p.startsWith('/dashboard/parametres'), icone: ICONE_PLUS_DESTINATION },
  ]
}

function destinationDocuments(): Destination {
  return {
    // Toujours `/dashboard/chiffres/documents` : voir le commentaire plus haut — ce rail n'est
    // jamais monté sans que `Documents.tsx` sache déjà montrer la v2 à cette adresse, PWA ou
    // site.
    href: '/dashboard/chiffres/documents',
    label: 'Documents',
    actif: p => p.startsWith('/dashboard/chiffres/documents') || p.startsWith('/dashboard/factures'),
    icone: ICONE_DOCUMENT,
  }
}

// Même raisonnement que `destinationDocuments()` ci-dessus : une seule adresse, qui marche
// aussi bien pour la PWA que pour le site en mode bureau.
const NOUVEAU_HREF = '/dashboard/chiffres/documents?nouveau=1'

function LigneRail({ item, actif }: { item: Destination; actif: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={actif ? 'page' : undefined}
      className={`flex h-[42px] items-center gap-[11px] rounded-[var(--v2-radius-bouton)] px-3 text-[13.5px] ${corpsFort} transition-colors ${
        actif
          ? 'bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] shadow-[0_1px_3px_rgba(22,22,26,.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,.4)]'
          : 'text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]'
      }`}
    >
      <span className="shrink-0 [&>svg]:block [&>svg]:h-[19px] [&>svg]:w-[19px]">{item.icone}</span>
      {item.label}
    </Link>
  )
}

type Props = {
  /** Nom tel qu'enregistré sur la fiche laveur (`washer.name`) — un seul champ, pas de
   *  distinction société/personne comme dans la maquette (« Éclat Mobile » / « Julien
   *  Roussel ») : le schéma réel n'a qu'un nom. Absent pour un compte sans fiche laveur
   *  (ex. support) — voir DashboardShell.tsx, `washerName`. */
  washerName?: string
  /** PWA installée (téléphone ou ordinateur) — décide des deux adresses qui ont un
   *  garde-fou PWA-seule (Chiffres, Documents) et de l'ajout déconnexion/thème ci-dessous. */
  isPwa: boolean
  /** Déjà calculé par DashboardShell (`planEffectif`/`accesComplet`, PlanBadge) : pas
   *  recalculé ici, pour ne jamais diverger de ce que montre le reste du châssis. */
  offreLabel: string
  offreCouleur: string | null
}

export function RailBureauV2({ washerName, isPwa, offreLabel, offreCouleur }: Props) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const items = destinations()
  const docs = destinationDocuments()
  const nouveauHref = NOUVEAU_HREF

  return (
    <nav
      aria-label="Navigation"
      className={`wb-rail-verre m-3.5 mr-0 flex shrink-0 flex-col rounded-[var(--bureau-radius-chassis)] p-3.5 ${police}`}
      style={{ width: 'var(--bureau-rail-largeur)', margin: '14px 0 14px 14px' }}
    >
      {/* Marque — remplace ce que montrait l'ancien en-tête (« WashBoard » + le nom de la
          fiche laveur en gris dessous, voir DashboardShell.tsx) : même paire d'informations,
          pas la paire société/personne de la maquette, que le schéma ne porte pas. */}
      <div className="flex items-center gap-2.5 px-1.5 pb-[18px] pt-1">
        <span className="block h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[9px]">
          <img src="/LogoWashBoard.png" alt="" className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0 leading-[1.15]">
          <span className={`block truncate text-[13.5px] ${nom} text-[color:var(--v2-color-encre)]`}>WashBoard</span>
          {washerName && (
            <span className={`block truncate text-[11px] ${corps} text-[color:var(--v2-color-gris)]`}>{washerName}</span>
          )}
        </span>
      </div>

      {/* Nouveau — même destination que le bouton central de BarreBasV2.tsx (devis ou
          facture), mêmes règles de remplacement plutôt que d'empilement quand on y est déjà. */}
      <Link
        href={nouveauHref}
        onClick={e => {
          if (pathname.startsWith('/dashboard/chiffres/documents')) {
            e.preventDefault()
            router.replace(nouveauHref, { scroll: false })
          }
        }}
        className={`mx-0.5 mb-[18px] flex h-11 items-center justify-center gap-2 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} shadow-[0_4px_14px_rgba(48,96,144,.35)] dark:shadow-[0_4px_14px_rgba(110,159,208,.35)]`}
        style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nouveau
      </Link>

      {/* Les 5 destinations */}
      <div className="flex flex-1 flex-col gap-0.5">
        {items.map(item => (
          <LigneRail key={item.label} item={item} actif={item.actif(pathname)} />
        ))}
      </div>

      {/* Documents, épinglé à part — un filet au-dessus, pas fondu dans la liste
          (Alexandre, 2026-10-03). */}
      <div className="mt-2.5 border-t border-[color:var(--v2-filet)] pt-2.5">
        <LigneRail item={docs} actif={docs.actif(pathname)} />
      </div>

      {/* Pied : l'offre du laveur, et — ajout hors maquette — déconnexion/thème côté site. */}
      <div className="mt-2 border-t border-[color:var(--v2-filet)] pt-3">
        {washerName && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[color:var(--v2-color-encre)] text-[11px] ${corpsFort} text-[color:var(--v2-color-surface)]`}
              aria-hidden
            >
              {initiales(washerName)}
            </span>
            <span className={`truncate ${corpsFort} text-[color:var(--v2-color-encre)]`}>{washerName}</span>
            <span
              className={`ml-auto shrink-0 whitespace-nowrap rounded-full border px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.06em] ${corps}`}
              style={{ borderColor: 'var(--v2-filet-fort)', color: offreCouleur ?? 'var(--v2-color-gris)' }}
            >
              {offreLabel}
            </span>
          </div>
        )}

        {/* Nécessaire côté SITE, absent de la maquette (ses captures restent côté PWA, où
            « Plus » porte déjà déconnexion/thème — ParametresFormV2.tsx) : le rail retire
            l'ancien en-tête EN ENTIER (consigne de la passe), mais `/dashboard/parametres`
            affiche encore ParametresFormV1 pour un laveur sur le site (fork sur
            `usePwaStandalone()`, pas sur `useDashboardV2()` — voir ParametresForm.tsx), qui ne
            porte NI l'un NI l'autre. Sans cette ligne, un laveur sur le site en mode bureau
            n'aurait plus aucun moyen de se déconnecter nulle part. Masqué côté PWA : redondant,
            Plus l'a déjà. */}
        {!isPwa && (
          <div className="mt-1 flex items-center justify-between gap-1 px-2.5">
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className={`text-[12px] ${corpsFort}`} style={{ color: 'var(--v2-color-rouge)' }}>
                Déconnexion
              </button>
            </form>
            <ThemeToggle nav />
          </div>
        )}
      </div>
    </nav>
  )
}
