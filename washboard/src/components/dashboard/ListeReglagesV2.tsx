'use client'

import { resumeNotifications } from '@/components/dashboard/FeuilleNotificationsV2'
import { useNotificationsPush } from '@/hooks/useNotificationsPush'
import { usePreferenceLocale } from '@/hooks/usePreferenceLocale'
import { CLE_CARTE_CACHEE } from '@/lib/reglagesMasques'
import { CarteListe, Chevron, Ligne, NonLus, TitreSection } from '@/components/dashboard/ParametresFormV2'
import { useSupportBadges } from '@/components/dashboard/SupportBadgesContext'
import { PLAN_LABELS, type Plan } from '@/lib/plan'
import Link from 'next/link'

// Liste « Plus » — extraite de ParametresFormV2.tsx (passe bureau, 2026-10-06) pour être
// réutilisable À CÔTÉ du contenu de chacune des 5 destinations qu'elle ouvre (Mon profil, Mes
// liens, Prestations et prix, Horaires, Apparence de ma page) : c'est elle que
// `washboard-design/maquettes/bureau-2026/index.html` (écrans 60 et 10) montre à gauche, en
// permanence, pendant qu'un réglage s'affiche à droite — le même geste que Clients et
// l'Agenda, déjà livrés (voir `ClientsViewV2.tsx`).
//
// Jamais rendue seule hors d'un écran « grand écran » (≥1024px, voir `useGrandEcran`) : sur
// téléphone (PWA ou site), chaque destination reste sa propre page plein écran, et c'est
// `ParametresFormV2` qui rend cette liste SEULE, sans colonne de droite — comportement inchangé
// par cette extraction.
//
// `selection` marque la ligne de la destination actuellement ouverte (fond `--v2-filet`, comme
// `.compte-row.selected` dans la maquette) — `null` sur `/dashboard/parametres` elle-même, où
// aucune ligne n'est ouverte (écran de repos).
//
// Chaque appelant passe ce qu'il a déjà sous la main, jamais une colonne lue en plus pour
// l'occasion (voir le rapport de la passe) : `servicesCount`/`resumeHoraires`/
// `facturationIncomplete`/`brandColor` restent `undefined` quand la page qui ouvre cet écran
// n'a pas déjà cette donnée (ex. « Mes liens » n'a jamais lu les prestations) — la ligne
// s'affiche alors sans son annotation plutôt qu'avec un chiffre ou un badge inventé, même
// règle que `ParametresFormV2` avant cette passe.
//
// `'reglages'` et `'abonnement'` (passe « Plus bureau, second lot », 2026-10-06) : les quatre
// écrans qu'ouvre la section « Mon compte » (Réglages, Abonnement, et — un niveau plus bas,
// depuis Réglages — Guide et Assistance) marquent tous la MÊME ligne sélectionnée que celle
// qu'on a cliquée pour y arriver. Guide et Assistance n'ont pas leur propre ligne ICI (elles
// vivent dans la liste « De l'aide » de `ReglagesV2`, pas dans celle-ci) : leur pane affiche
// donc `selection="reglages"` ET son propre fil d'Ariane « ‹ Réglages », exactement comme la
// maquette (écrans 63/64 : la ligne surlignée à gauche reste « Réglages », un petit lien
// « ‹ Réglages » apparaît en haut du panneau).
export type ClePlus = 'profil' | 'liens' | 'prestations' | 'horaires' | 'apparence' | 'reglages' | 'abonnement' | null

export type ReglagesListeProps = {
  nom: string
  slug?: string | null
  brandColor?: string | null
  plan: Plan
  grandfathered?: boolean
  servicesCount?: number
  resumeHoraires?: string
  facturationIncomplete?: boolean
}

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom2 = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`

// Même algorithme que ClientsViewV2.tsx / RailBureauV2.tsx — dupliqué comme eux plutôt que
// partagé, voir leur propre commentaire pour pourquoi.
function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

// `deuxColonnes` : seul l'écran de repos de « Plus » (ParametresFormV2) s'en sert. Les cinq
// écrans qui ouvrent un réglage gardent la colonne unique de 320px à gauche du détail — c'est
// elle qui reste l'ancre pendant qu'on fait défiler le détail. Au repos il n'y a pas de détail :
// la même liste en une colonne fait 748px de haut (mesuré) à côté d'un bloc de 191px, soit
// ~557px de vide à droite à TOUTES les largeurs. Sur deux colonnes elle retombe vers ~430px et
// l'écran tient sans défilement. Le basculement est purement CSS (`min-[1320px]`, soit la
// largeur minimale où les deux colonnes de 320px tiennent en laissant de quoi afficher la
// vignette à droite — 1366px, le portable le plus courant, en fait partie) : pas de
// sixième mécanisme de décision en JavaScript à côté des quatre déjà en place.
type Props = ReglagesListeProps & { selection: ClePlus; deuxColonnes?: boolean }

export default function ListeReglagesV2({
  nom, slug, brandColor, plan, grandfathered, servicesCount, resumeHoraires, facturationIncomplete, selection,
  deuxColonnes = false,
}: Props) {
  const { estEquipeSupport, unreadSupportCount, unreadTeamCount } = useSupportBadges()
  const { etat: etatNotifications } = useNotificationsPush()
  // Conservée telle quelle (voir ParametresFormV2 avant cette passe, 2026-09-27) : la carte
  // « Configuration de votre compte » se met de côté depuis elle-même.
  usePreferenceLocale(CLE_CARTE_CACHEE)
  const notifications = resumeNotifications(etatNotifications)
  const planLabel = grandfathered ? 'Accès complet' : PLAN_LABELS[plan]

  // `grid-cols-1` + `gap-y-6` se comporte exactement comme le `space-y-6` d'avant : c'est le
  // même rythme vertical, mais on peut y ajouter une seconde colonne sans toucher aux sections.
  return (
    <div
      className={`grid grid-cols-1 items-start gap-x-5 gap-y-6 ${deuxColonnes ? 'min-[1320px]:grid-cols-2' : ''} ${police}`}
    >
      {/* La carte d'identité reste en tête, sur toute la largeur : c'est l'en-tête de la liste,
          pas une section parmi les autres. */}
      <CarteListe className="col-span-full">
        <div className="flex items-center gap-3 py-3.5">
          <span
            className={`w-[42px] h-[42px] shrink-0 rounded-[12px] bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] flex items-center justify-center text-[16px] ${corpsFort} tracking-tight`}
            aria-hidden
          >
            {initiales(nom)}
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-px">
            <span className={`text-[16px] ${nom2} truncate`}>{nom}</span>
            <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Votre page de réservation</span>
          </span>
          {slug && (
            <a href={`/book/${slug}`} className={`text-[13px] ${corpsFort} shrink-0`} style={{ color: 'var(--v2-color-accent)' }}>
              Voir
            </a>
          )}
        </div>
      </CarteListe>

      <div>
        <TitreSection>L’argent</TitreSection>
        <CarteListe>
          <Ligne label="Chiffres" sousLabel="Argent, acquisition, clients" href="/dashboard/chiffres" />
          <Ligne label="Devis et factures" sousLabel="Écrits à la main" href="/dashboard/chiffres/documents" />
        </CarteListe>
      </div>

      <div>
        <TitreSection>De temps en temps</TitreSection>
        <CarteListe>
          <Ligne
            label="Mon profil"
            sousLabel="Entreprise, factures"
            valeur={facturationIncomplete ? 'À compléter' : undefined}
            href="/dashboard/parametres/profil"
            selected={selection === 'profil'}
          />
          <Ligne
            label="Mes liens"
            sousLabel="Réservation, réseaux"
            href="/dashboard/parametres/liens"
            selected={selection === 'liens'}
          />
        </CarteListe>
      </div>

      <div>
        <TitreSection>Une fois</TitreSection>
        <CarteListe>
          <Ligne
            label="Prestations et prix"
            sousLabel="Zone d’intervention"
            valeur={typeof servicesCount === 'number' ? String(servicesCount) : undefined}
            href="/dashboard/parametres/prestations"
            selected={selection === 'prestations'}
          />
          <Ligne
            label="Horaires"
            valeur={resumeHoraires}
            href="/dashboard/parametres/horaires"
            selected={selection === 'horaires'}
          />
          <Link
            href="/dashboard/parametres/apparence"
            className={`flex items-center gap-2.5 min-h-[46px] py-1.5 w-full ${selection === 'apparence' ? 'bg-[color:var(--v2-filet)]' : ''}`}
          >
            <span className={`flex-1 text-[15px] ${corps}`}>Apparence de ma page</span>
            {brandColor && (
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-[color:var(--v2-filet-fort)]"
                style={{ backgroundColor: brandColor }}
                aria-hidden
              />
            )}
            <Chevron />
          </Link>
        </CarteListe>
      </div>

      <div>
        <TitreSection>Mon compte</TitreSection>
        <CarteListe>
          <Ligne label="Abonnement" valeur={planLabel} href="/dashboard/abonnement" selected={selection === 'abonnement'} />
          <Ligne
            label="Réglages"
            signal={notifications.ton === 'ambre' || unreadSupportCount
              ? <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-ambre)' }} aria-hidden />
              : undefined}
            href="/dashboard/parametres/reglages"
            selected={selection === 'reglages'}
          />
          <form action="/api/auth/logout" method="POST" className="flex items-center min-h-[46px] py-1.5">
            <button type="submit" className={`text-[15px] ${corps} text-left`} style={{ color: 'var(--v2-color-rouge)' }}>
              Déconnexion
            </button>
          </form>
        </CarteListe>
      </div>

      {estEquipeSupport && (
        <div>
          <TitreSection>Outil interne</TitreSection>
          <CarteListe>
            <Ligne
              label="Support (équipe)"
              href="/dashboard/support"
              signal={<NonLus count={unreadTeamCount} />}
            />
          </CarteListe>
        </div>
      )}
    </div>
  )
}
