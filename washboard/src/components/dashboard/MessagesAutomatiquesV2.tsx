'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ReglageAvisV2, ReglageRelanceV2 } from '@/components/dashboard/ReglageAutomatismeV2'
import { Interrupteur } from '@/components/dashboard/PrestationsUiV2'
import { enregistrerReglages } from '@/lib/enregistrerReglages'
import {
  avisActif, blocageAvis, relanceActive, nombreActifs, libelleCanal, libelleDelaiAvis, libelleDelaiRelance,
  messagesPartis, messagesProgrammes, messageRelanceSuggere,
  type LigneMessage, type RdvMessage, type ReglagesMessages,
} from '@/lib/messagesAutomatiques'

// « Messages automatiques » — refonte 2026, planche `project/ARelancer.dc.html`.
// Réservé à la PWA installée (voir MessagesAutomatiques.tsx, le garde-fou) ;
// le site continue de régler ces deux automatismes dans `ParametresFormV1`
// (cartes « Avis Google » et « Relances clients »), inchangées.
//
// Le principe de la planche : on règle le délai UNE fois, ensuite ça part tout
// seul — l'écran montre ce qui est programmé et ce qui est parti, il ne demande
// rien à valider.
//
// CE QUE LES DONNÉES PERMETTENT (le détail et ses limites : lib/messagesAutomatiques.ts) :
//  · les deux interrupteurs et leur résumé : réels (`review_*`, `followup_*`) ;
//  · « Programmé » : calculé avec la règle exacte des deux crons ;
//  · « Parti » : les envois de la semaine, dont une partie DÉDUITE (aucun accusé
//    d'envoi n'est enregistré pour l'email ni pour la relance) — l'écran le dit ;
//  · résultats : « a réservé depuis » pour une relance, oui ; « 5 étoiles reçues »
//    et « pas de réponse », non — la base ne les connaît pas.
//
// COUPÉ, faute de donnée : le lien « passer » (aucun moyen d'annuler l'envoi d'un
// message précis), la section « clients écartés et pourquoi » (aucune trace
// d'opposition à être contacté ; le reste se déduirait mal), le canal WhatsApp.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

const NB_LIGNES = 5

function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

export type MessagesAutomatiquesProps = {
  reglages: ReglagesMessages
  smsAutorise: boolean
  /** Le plan autorise l'ACTIVATION des relances (Pro) — la route refuse sinon. */
  relanceAutorisee: boolean
  libellePlanRelance: string
  nomLaveur: string
  slug: string
  rdvs: RdvMessage[]
  /** La lecture des rendez-vous a échoué ou s'est arrêtée en route. */
  lectureIncomplete: boolean
}

type FeuilleOuverte = { quoi: 'avis' | 'relance'; activer: boolean } | null

function LigneAutomatisme({
  libelle, resume, avertissement, actif, enCours, onBasculer, onOuvrir, href, verrouille,
}: {
  libelle: string
  resume: string
  /** Pourquoi rien ne part alors que c'est allumé — remplace le résumé, en ambre. */
  avertissement?: string | null
  actif: boolean
  enCours: boolean
  onBasculer: () => void
  onOuvrir?: () => void
  href?: string
  verrouille?: boolean
}) {
  const texte = (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={`text-[15.5px] ${corpsFort}`}>{libelle}</span>
      <span
        className={`text-[12.5px] ${corps} ${avertissement ? '' : 'text-[color:var(--v2-color-gris)]'}`}
        style={avertissement ? { color: 'var(--v2-color-ambre)' } : undefined}
      >
        {avertissement ?? resume}
      </span>
    </span>
  )
  const zone = 'flex min-h-[60px] min-w-0 flex-1 items-center py-2 text-left'
  return (
    <div className="flex items-center gap-1">
      {href ? (
        <Link href={href} className={zone}>{texte}</Link>
      ) : (
        <button type="button" onClick={onOuvrir} className={zone}>{texte}</button>
      )}
      <Interrupteur actif={actif} enCours={enCours} libelle={libelle} onClick={onBasculer} verrouille={verrouille} />
      {href ? (
        <Link href={href} aria-label={`Réglages : ${libelle}`} className="flex h-11 w-8 shrink-0 items-center justify-center text-[color:var(--v2-color-encre-pale)]">
          <ChevronRight size={17} strokeWidth={2} />
        </Link>
      ) : (
        <button type="button" onClick={onOuvrir} aria-label={`Réglages : ${libelle}`} className="flex h-11 w-8 shrink-0 items-center justify-center text-[color:var(--v2-color-encre-pale)]">
          <ChevronRight size={17} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

function Section({
  titre: intitule, nombre, children,
}: { titre: string; nombre: number; children: React.ReactNode }) {
  return (
    <section className="mt-[22px]">
      <div className="flex items-baseline justify-between px-0.5 pb-2">
        <h2 className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{intitule}</h2>
        <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>{nombre}</span>
      </div>
      {children}
    </section>
  )
}

function Carte({ children, liste }: { children: React.ReactNode; liste?: boolean }) {
  const Corps = liste ? 'ul' : 'div'
  return (
    <div className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
      <Corps className="divide-y divide-[color:var(--v2-filet)] px-4">{children}</Corps>
    </div>
  )
}

function Point({ type }: { type: LigneMessage['type'] }) {
  return (
    <span
      aria-hidden
      className="h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ backgroundColor: type === 'avis' ? 'var(--v2-color-ambre)' : 'var(--v2-color-accent)' }}
    />
  )
}

function LigneMessageV2({ ligne, avecType }: { ligne: LigneMessage; avecType: boolean }) {
  const couleur =
    ligne.ton === 'ok' ? 'var(--v2-color-vert)' : ligne.ton === 'neutre' ? 'var(--v2-color-encre)' : 'var(--v2-color-gris)'
  return (
    <li className="flex items-center gap-3 py-[11px]">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--v2-filet)] text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
        aria-hidden
      >
        {initiales(ligne.nom)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={`truncate text-[15px] ${nom}`}>{ligne.nom}</span>
        <span className={`flex items-start gap-2 text-[12.5px] leading-[1.35] ${corps} text-[color:var(--v2-color-gris)]`}>
          <span className="mt-[5px] flex"><Point type={ligne.type} /></span>
          <span className="min-w-0">
            {avecType && <><span className={corpsFort}>{ligne.type === 'avis' ? 'Avis' : 'Relance'}</span>{' · '}</>}
            {ligne.detail}
          </span>
        </span>
      </span>
      <span className={`max-w-[36%] shrink-0 text-right leading-[1.3] text-[12.5px] ${corpsFort}`} style={{ color: couleur }}>
        {ligne.droite}
      </span>
    </li>
  )
}

function ListeMessages({
  lignes, avecType, vide,
}: { lignes: LigneMessage[]; avecType: boolean; vide: string }) {
  const [toutes, setToutes] = useState(false)
  if (lignes.length === 0) {
    return (
      <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-4">
        <p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>{vide}</p>
      </div>
    )
  }
  const visibles = toutes ? lignes : lignes.slice(0, NB_LIGNES)
  const reste = lignes.length - NB_LIGNES
  return (
    <Carte liste>
      {visibles.map(l => <LigneMessageV2 key={l.cle} ligne={l} avecType={avecType} />)}
      {reste > 0 && (
        <li className="list-none">
          <button
            type="button"
            onClick={() => setToutes(v => !v)}
            aria-expanded={toutes}
            className={`flex min-h-11 w-full items-center justify-center text-[13.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
          >
            {toutes ? 'Réduire' : `Voir les ${reste} autres`}
          </button>
        </li>
      )}
    </Carte>
  )
}

export default function MessagesAutomatiquesV2({
  reglages: reglagesServeur, smsAutorise, relanceAutorisee, libellePlanRelance, nomLaveur, slug, rdvs, lectureIncomplete,
}: MessagesAutomatiquesProps) {
  const router = useRouter()
  // Réglages locaux : mis à jour dès qu'une écriture réussit, sans attendre le
  // rechargement de la page — les listes se recalculent aussitôt.
  const [reglages, setReglages] = useState(reglagesServeur)
  const [feuille, setFeuille] = useState<FeuilleOuverte>(null)
  const [enCours, setEnCours] = useState<'avis' | 'relance' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  // Lu une seule fois : tout l'écran calcule sur le même « maintenant ».
  const [maintenant] = useState(() => Date.now())
  const ctx = useMemo(() => ({ smsAutorise }), [smsAutorise])

  const avisMarche = avisActif(reglages, ctx)
  const relanceMarche = relanceActive(reglages)
  const blocage = reglages.review_enabled ? blocageAvis(reglages, ctx) : null
  const actifs = nombreActifs(reglages, ctx)

  const programmes = useMemo(() => messagesProgrammes(reglages, ctx, rdvs, maintenant), [reglages, ctx, rdvs, maintenant])
  const partis = useMemo(() => messagesPartis(reglages, ctx, rdvs, maintenant), [reglages, ctx, rdvs, maintenant])

  async function ecrire(champs: Partial<ReglagesMessages>): Promise<string | null> {
    const r = await enregistrerReglages(champs)
    if (!r.ok) return r.message
    setReglages(prev => ({ ...prev, ...champs }))
    router.refresh()
    return null
  }

  async function enregistrerDepuisFeuille(champs: Partial<ReglagesMessages>): Promise<string | null> {
    const message = await ecrire(champs)
    if (!message) { setErreur(null); setFeuille(null) }
    return message
  }

  // Interrupteur. Éteindre, ou allumer ce qui est prêt : une écriture, avec
  // retour à l'état d'origine si elle échoue (l'affichage suit la base, pas le
  // doigt). Allumer ce qui ne pourrait PAS partir (pas de lien d'avis, pas de
  // message de relance, SMS hors plan) : on ouvre le réglage à la place —
  // jamais un interrupteur allumé qui n'envoie rien.
  async function basculer(quoi: 'avis' | 'relance') {
    setErreur(null)
    const allume = quoi === 'avis' ? avisMarche : relanceMarche
    const champ = quoi === 'avis' ? 'review_enabled' : 'followup_enabled'

    if (!allume) {
      const pret = quoi === 'avis'
        ? blocageAvis(reglages, ctx) === null
        : !!reglages.followup_message?.trim()
      if (!pret) { setFeuille({ quoi, activer: true }); return }
    }

    const avant = reglages
    setReglages({ ...reglages, [champ]: !allume })
    setEnCours(quoi)
    const message = await ecrire({ [champ]: !allume })
    setEnCours(null)
    if (message) {
      setReglages(avant)
      setErreur(message)
    }
  }

  const lienReservation = typeof window !== 'undefined' ? `${window.location.origin}/book/${slug}` : `/book/${slug}`
  const sousTitre = actifs === 0 ? 'Aucun actif · rien à valider' : `${actifs} actif${actifs > 1 ? 's' : ''} · rien à valider`

  const avertissementAvis = blocage === 'lien'
    ? 'Rien ne part : ajoutez votre lien d’avis Google'
    : blocage === 'sms' ? 'Rien ne part : le SMS est réservé au plan Pro' : null
  const avertissementRelance = reglages.followup_enabled && !reglages.followup_message?.trim()
    ? 'Rien ne part : écrivez le message à envoyer' : null

  return (
    <div
      className={`max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div className="flex items-center gap-1 pb-3">
        <Link
          href="/dashboard/parametres"
          aria-label="Retour à Plus"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0">
          <h1 className={`text-[21px] leading-none ${titre}`}>Messages automatiques</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>
        </div>
      </div>

      <Carte>
        <LigneAutomatisme
          libelle="Demande d’avis Google"
          resume={`${libelleDelaiAvis(reglages.review_delay_hours)} · ${libelleCanal(reglages.review_channel)}`}
          avertissement={avertissementAvis}
          actif={avisMarche}
          enCours={enCours === 'avis'}
          onBasculer={() => basculer('avis')}
          onOuvrir={() => setFeuille({ quoi: 'avis', activer: false })}
        />
        {relanceAutorisee || reglages.followup_enabled ? (
          <LigneAutomatisme
            libelle="Relance"
            resume={`${libelleDelaiRelance(reglages.followup_delay_days)} · ${libelleCanal(reglages.review_channel)}`}
            avertissement={avertissementRelance}
            actif={relanceMarche}
            enCours={enCours === 'relance'}
            onBasculer={() => basculer('relance')}
            onOuvrir={() => setFeuille({ quoi: 'relance', activer: false })}
          />
        ) : (
          // Essentiel : la route refuse d'activer les relances. Le réglage
          // mène à l'abonnement plutôt qu'à un interrupteur qui échouerait.
          <LigneAutomatisme
            libelle="Relance"
            resume={`Réservé au plan ${libellePlanRelance}`}
            actif={false}
            enCours={false}
            verrouille
            onBasculer={() => {}}
            href="/dashboard/abonnement"
          />
        )}
      </Carte>

      <p className={`mt-3 px-1 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
        Vous réglez le délai une fois, les messages partent seuls. Rien à cocher chaque semaine.
      </p>

      {erreur && (
        <p role="alert" className={`mt-3 px-1 text-[13px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>
      )}

      {lectureIncomplete ? (
        <p role="status" className={`mt-[22px] px-1 text-[13px] ${corps} leading-[1.55]`} style={{ color: 'var(--v2-color-ambre)' }}>
          Vos rendez-vous n’ont pas pu être lus en entier : les listes de messages programmés et envoyés sont masquées
          plutôt qu’incomplètes. Vos réglages, eux, fonctionnent. Rechargez la page dans un instant.
        </p>
      ) : (
        <>
          <Section titre="Programmé" nombre={programmes.length}>
            <ListeMessages
              lignes={programmes}
              avecType
              vide={actifs === 0
                ? 'Rien n’est programmé : aucun message automatique n’est actif.'
                : 'Rien n’est programmé pour les 7 prochains jours.'}
            />
          </Section>

          <Section titre="Parti ces 7 derniers jours" nombre={partis.length}>
            <ListeMessages lignes={partis} avecType={false} vide="Aucun message n’est parti ces 7 derniers jours." />
            {partis.some(l => l.deduit) && (
              <p className={`mt-2 px-1 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
                WashBoard n’enregistre pas d’accusé d’envoi : les emails d’avis et les relances sont déduits de l’historique
                de vos rendez-vous. « A réservé depuis » signifie qu’un rendez-vous a été pris après la relance, sans preuve
                que le message en soit la cause.
              </p>
            )}
          </Section>
        </>
      )}

      {feuille?.quoi === 'avis' && (
        <ReglageAvisV2
          reglages={reglages}
          canal={reglages.review_channel}
          smsAutorise={smsAutorise}
          activer={feuille.activer}
          nomLaveur={nomLaveur}
          onClose={() => setFeuille(null)}
          enregistrer={enregistrerDepuisFeuille}
        />
      )}
      {feuille?.quoi === 'relance' && (
        <ReglageRelanceV2
          reglages={reglages}
          canal={reglages.review_channel}
          smsAutorise={smsAutorise}
          activer={feuille.activer}
          messageSuggere={messageRelanceSuggere(lienReservation)}
          rdvs={rdvs}
          maintenant={maintenant}
          lectureIncomplete={lectureIncomplete}
          onClose={() => setFeuille(null)}
          enregistrer={enregistrerDepuisFeuille}
        />
      )}
    </div>
  )
}
