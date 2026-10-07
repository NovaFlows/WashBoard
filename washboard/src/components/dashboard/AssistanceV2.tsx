'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { useSupportThreads } from '@/lib/useSupportThreads'
import { useLigneGlissante, LARGEUR_ACTION_PX } from '@/hooks/useLigneGlissante'
import { BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe, Chevron, FilAriane } from '@/components/dashboard/ParametresFormV2'
import { ConfirmationSuppression, Constat, nom } from '@/components/dashboard/PrestationsUiV2'
import { BullesConversationV2, ComposerReponseV2, FeuilleFilV2, FeuilleNouvelleQuestionV2 } from '@/components/dashboard/FeuillesAssistanceV2'
import AccesSupportV2 from '@/components/dashboard/AccesSupportV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import type { SupportThread } from '@/lib/support'

// « Aide et assistance » — refonte 2026 (PWA en bêta seulement ; le site garde
// `AssistanceContent`, inchangé). Demande d'Alexandre, 2026-09-26 : « redesign la partie pour
// que ce soit totalement en harmonie avec l'appli ».
//
// Trois blocs, dans l'ordre où on en a besoin : chercher soi-même (le Guide), parler à
// l'équipe (les questions, chacune une conversation qui s'ouvre en feuille), et l'accès de
// l'équipe au compte (« Aide à la configuration »). Toute la logique (envoi optimiste, lu /
// non lu, suppression d'une conversation de sa liste) vient de `useSupportThreads`, la même
// que l'écran du site.
//
// PASSE « PLUS BUREAU, SECOND LOT » (2026-10-06) : sur grand écran, la feuille devient un
// panneau à côté — même geste que Clients (liste à gauche, fiche à droite en permanence) —
// mais ici la liste des RÉGLAGES (`ListeReglagesV2`) et la liste des CONVERSATIONS doivent
// cohabiter. Vérifié sur l'artboard (`Assistance.dc.html`, écran 64) avant d'écrire une ligne :
// la maquette les empile côte à côte plutôt que de choisir — `ListeReglagesV2` à gauche de
// tout (sélection « Réglages », puisque Guide et Assistance n'ont pas leur propre ligne, voir
// `ListeReglagesV2.tsx`), puis DANS le panneau de droite, une seconde colonne plus étroite
// (300px, questions) et la conversation ouverte. Pas de conflit à arbitrer : deux listes à deux
// niveaux différents, pas deux listes qui se disputent la même colonne.
//
// `SupportConversation.tsx` (la version « site », utilisée par `AssistanceContent` et le
// panneau du Guide) n'a PAS été réutilisée ici : elle écrit ses propres couleurs en dur
// (`#1651E8`, `bg-slate-*`) plutôt que les jetons `--v2-*`, exactement ce que `CONTRAT.md`
// interdit côté v2 — la poser telle quelle aurait fait une pièce rapportée, comme la carte
// d'offre verrouillée d'avant `OffreVerrouilleeV2` (voir son en-tête). La présentation du fil
// ouvert est donc reconstruite ici à partir des mêmes briques déjà en jetons v2 que la feuille
// mobile (`BullesConversationV2`, `ComposerReponseV2`, extraites de `FeuilleFilV2` pour cette
// passe) : aucune logique dupliquée, seul l'emballage change (feuille qui monte vs colonne
// toujours visible).

type Feuille = { quoi: 'nouvelle' } | { quoi: 'fil'; id: string } | null

function triParRecence(fils: SupportThread[]): SupportThread[] {
  return [...fils].sort((a, b) => (b.messages.at(-1)?.createdAt ?? '').localeCompare(a.messages.at(-1)?.createdAt ?? ''))
}

function apercu(fil: SupportThread): string {
  const dernier = fil.messages.at(-1)
  if (!dernier) return ''
  return `${dernier.from === 'laveur' ? 'Vous' : 'Équipe'} : ${dernier.text}`
}

function LigneFil({
  fil, ouverte, onOuvrirLigne, onFermerLigne, onOuvrir, onSupprimer, selectionnee = false,
}: {
  fil: SupportThread
  ouverte: boolean
  onOuvrirLigne: () => void
  onFermerLigne: () => void
  onOuvrir: () => void
  onSupprimer: () => void
  /** Grand écran uniquement : cette conversation est celle affichée dans le panneau de droite
   *  en ce moment (fond `--v2-filet`, comme `.client-row.selected` dans la maquette). Toujours
   *  `false` sur téléphone, où ouvrir une conversation couvre la liste. */
  selectionnee?: boolean
}) {
  const { refLigne, poignee, styleContenu, clicAbsorbe } = useLigneGlissante({ ouverte, onOuvrir: onOuvrirLigne, onFermer: onFermerLigne })
  const nonLues = fil.nonLuesCount ?? 0
  const resolue = fil.status === 'resolue'
  return (
    <li ref={refLigne} className="relative overflow-hidden">
      {/* Derrière la ligne, révélée en la glissant vers la gauche (doigt seulement). */}
      <button
        type="button"
        onClick={onSupprimer}
        tabIndex={ouverte ? 0 : -1}
        aria-hidden={!ouverte}
        aria-label={`Supprimer la conversation ${fil.title}`}
        className={`absolute inset-y-1.5 right-0 flex flex-col items-center justify-center gap-1 rounded-[12px] text-[12px] text-white ${corpsFort}`}
        style={{ width: LARGEUR_ACTION_PX, background: 'var(--v2-color-rouge)' }}
      >
        <Trash2 size={20} strokeWidth={2} aria-hidden />
        Supprimer
      </button>
      <div {...poignee} style={styleContenu} className={`motion-reduce:!transition-none ${selectionnee ? 'bg-[color:var(--v2-filet)]' : 'bg-[color:var(--v2-color-surface)]'}`}>
        <button
          type="button"
          onClick={() => { if (!clicAbsorbe()) onOuvrir() }}
          className="flex min-h-[64px] w-full items-center gap-3 py-2.5 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`truncate text-[15.5px] ${nonLues > 0 ? corpsFort : nom}`}>{fil.title}</span>
            <span className={`truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{apercu(fil)}</span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: resolue ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)' }}
                aria-hidden
              />
              <span className={`text-[12px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{resolue ? 'Résolue' : 'Ouverte'}</span>
            </span>
          </span>
          {nonLues > 0 && (
            <span
              className={`flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1.5 text-[12px] tabular-nums text-white ${corpsFort}`}
              style={{ background: 'var(--v2-color-accent)' }}
            >
              <span aria-hidden>{nonLues > 9 ? '9+' : nonLues}</span>
              <span className="sr-only">{nonLues > 1 ? `${nonLues} messages non lus` : '1 message non lu'}</span>
            </span>
          )}
          <Chevron />
        </button>
      </div>
    </li>
  )
}

/** Panneau de droite, grand écran : la conversation ouverte, le formulaire de nouvelle
 *  question, ou une invitation quand rien n'est sélectionné. Même silhouette que
 *  `.pane.surface` de la maquette (écran 64) : un en-tête, le corps qui défile, le composer
 *  fixé en bas. Construit à partir des briques déjà en jetons v2 (`BullesConversationV2`,
 *  `ComposerReponseV2`) — voir l'en-tête du fichier pour pourquoi `SupportConversation.tsx`
 *  n'a pas été repris tel quel. */
function PanneauConversationV2({ feuille, filOuvert, erreurNouvelle, erreurFil, onEnvoyerNouvelle, onEnvoyerFil }: {
  feuille: Feuille
  filOuvert: SupportThread | undefined
  erreurNouvelle: { message: string; texte: string } | null
  erreurFil: { message: string; texte: string } | null
  onEnvoyerNouvelle: (texte: string) => void
  onEnvoyerFil: (texte: string) => void
}) {
  const fin = useRef<HTMLDivElement>(null)
  const [texteFil, setTexteFil] = useState('')
  const [texteNouvelle, setTexteNouvelle] = useState('')

  useEffect(() => { if (erreurFil) setTexteFil(erreurFil.texte) }, [erreurFil])
  useEffect(() => { if (erreurNouvelle) setTexteNouvelle(erreurNouvelle.texte) }, [erreurNouvelle])
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [filOuvert?.messages.length])
  // Une question envoyée fait basculer `feuille` sur son fil, dont le composer repart vide.
  useEffect(() => { if (feuille?.quoi === 'fil') setTexteFil('') }, [feuille])

  if (feuille?.quoi === 'fil' && filOuvert) {
    return (
      <div className="flex h-full min-h-[420px] flex-col">
        <div className="shrink-0 border-b border-[color:var(--v2-filet)] px-4 py-3.5">
          <p className={`text-[14.5px] ${corpsFort}`}>{filOuvert.title}</p>
          <p className={`mt-0.5 text-[11px] ${corpsFort}`} style={{ color: filOuvert.status === 'resolue' ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)' }}>
            {filOuvert.status === 'resolue' ? 'Résolue' : 'Ouverte'}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <BullesConversationV2 fil={filOuvert} erreur={erreurFil} finRef={fin} />
        </div>
        <div className="shrink-0 border-t border-[color:var(--v2-filet)] p-4">
          <ComposerReponseV2
            texte={texteFil}
            onChange={setTexteFil}
            onEnvoyer={() => {
              const t = texteFil.trim()
              if (!t) return
              onEnvoyerFil(t)
              setTexteFil('')
            }}
          />
        </div>
      </div>
    )
  }

  if (feuille?.quoi === 'nouvelle') {
    return (
      <div className="flex h-full min-h-[420px] flex-col">
        <div className="shrink-0 border-b border-[color:var(--v2-filet)] px-4 py-3.5">
          <p className={`text-[14.5px] ${corpsFort}`}>Nouvelle question</p>
          <p className={`mt-0.5 text-[11px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Une personne de l’équipe vous répond en moins de 24 h.
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <MessageCircle size={28} className="text-[color:var(--v2-color-gris)]" aria-hidden />
          <p className={`text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Décrivez votre souci en quelques mots, on vous répond directement ici.
          </p>
        </div>
        <div className="shrink-0 border-t border-[color:var(--v2-filet)] p-4">
          <ComposerReponseV2
            texte={texteNouvelle}
            onChange={setTexteNouvelle}
            onEnvoyer={() => {
              const t = texteNouvelle.trim()
              if (!t) return
              onEnvoyerNouvelle(t)
              setTexteNouvelle('')
            }}
          />
          {erreurNouvelle && <div className="mt-2.5"><Constat ton="rouge" role="alert">{erreurNouvelle.message}</Constat></div>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 p-6 text-center">
      <MessageCircle size={28} className="text-[color:var(--v2-color-gris)]" aria-hidden />
      <p className={`text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Choisissez une conversation à gauche, ou posez-en une nouvelle.
      </p>
    </div>
  )
}

type Props = {
  /** Liste « Plus », affichée tout à gauche sur grand écran (voir `ListeReglagesV2.tsx`). */
  liste: ReglagesListeProps
}

export default function AssistanceV2({ liste }: Props) {
  const grandEcran = useGrandEcran()
  const searchParams = useSearchParams()
  const filParam = searchParams.get('fil')
  const { threads, loaded, sendError, envoyerQuestion, ouvrirFil, dismissSendError, masquerFil } = useSupportThreads()

  const [feuille, setFeuille] = useState<Feuille>(null)
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<SupportThread | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null)

  // Lien direct `?fil=<id>` (notification, e-mail de réponse) : la conversation s'ouvre d'elle-même,
  // une fois les fils chargés. Un fil inconnu ou supprimé n'a pas l'air d'un incident : on reste sur la liste.
  const lienAppliqué = useRef(false)
  useEffect(() => {
    if (!loaded || lienAppliqué.current) return
    lienAppliqué.current = true
    if (filParam && threads.some(t => t.id === filParam)) {
      setFeuille({ quoi: 'fil', id: filParam })
      ouvrirFil(filParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, au chargement
  }, [loaded, threads])

  // Une nouvelle question qui échoue : le fil optimiste est retiré de la liste alors qu'on avait déjà
  // ouvert sa conversation — on revient sur le champ de saisie, texte et phrase d'échec restitués.
  useEffect(() => {
    if (!sendError) return
    if (feuille?.quoi === 'fil' && feuille.id === sendError.threadId && !threads.some(t => t.id === sendError.threadId)) {
      setFeuille({ quoi: 'nouvelle' })
    }
  }, [sendError, threads, feuille])

  const fils = triParRecence(threads)
  const filOuvert = feuille?.quoi === 'fil' ? threads.find(t => t.id === feuille.id) : undefined
  const erreurNouvelle = sendError && !threads.some(t => t.id === sendError.threadId) ? sendError : null
  const erreurFil = sendError && filOuvert && sendError.threadId === filOuvert.id ? sendError : null

  function ouvrir(fil: SupportThread) {
    setLigneOuverte(null)
    ouvrirFil(fil.id)
    dismissSendError()
    setFeuille({ quoi: 'fil', id: fil.id })
  }

  function fermerFeuille() {
    dismissSendError()
    setFeuille(null)
  }

  function envoyerNouvelle(texte: string) {
    const id = envoyerQuestion(texte, null)
    setFeuille({ quoi: 'fil', id })
  }

  async function confirmerSuppression() {
    if (!aSupprimer || suppressionEnCours) return
    setSuppressionEnCours(true)
    setSuppressionErreur(null)
    const message = await masquerFil(aSupprimer.id)
    setSuppressionEnCours(false)
    if (message) setSuppressionErreur(message)
    else setASupprimer(null)
  }

  // Carte « Guide » + section « Vos questions » : IDENTIQUE sur téléphone et sur grand écran
  // (seule la colonne qui l'entoure change de largeur) — `selectionnee` reste `false` partout
  // sauf dans la colonne étroite du panneau grand écran, juste en dessous.
  const colonneQuestions = (grandEcranSelection: boolean) => (
    <>
      <CarteListe>
        <Link href="/dashboard/guide" className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`text-[15.5px] ${nom}`}>Guide d’utilisation</span>
            <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Chercher une réponse par vous-même</span>
          </span>
          <Chevron />
        </Link>
      </CarteListe>

      <section className="mt-[26px]" aria-label="Vos questions">
        <div className="flex items-center justify-between gap-3 pb-1.5">
          <h2 className={`px-0.5 text-[19px] leading-tight ${titre}`}>Vos questions</h2>
          <button
            type="button"
            onClick={() => { dismissSendError(); setFeuille({ quoi: 'nouvelle' }) }}
            aria-label="Poser une nouvelle question"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-[.94] motion-reduce:transition-none"
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            <Plus size={22} strokeWidth={2.4} aria-hidden />
          </button>
        </div>

        {loaded && fils.length === 0 ? (
          <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
            <p className={`text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Pas de question pour l’instant. Décrivez votre souci en quelques mots : on vous répond directement ici.
            </p>
            <button
              type="button"
              onClick={() => { dismissSendError(); setFeuille({ quoi: 'nouvelle' }) }}
              className={`${BOUTON} mt-3.5 w-full text-white`}
              style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
            >
              Poser une question
            </button>
          </div>
        ) : fils.length > 0 ? (
          <CarteListe>
            <ul className="divide-y divide-[color:var(--v2-filet)]">
              {fils.map(f => (
                <LigneFil
                  key={f.id}
                  fil={f}
                  ouverte={ligneOuverte === f.id}
                  onOuvrirLigne={() => setLigneOuverte(f.id)}
                  onFermerLigne={() => setLigneOuverte(cur => (cur === f.id ? null : cur))}
                  onOuvrir={() => ouvrir(f)}
                  onSupprimer={() => { setLigneOuverte(null); setSuppressionErreur(null); setASupprimer(f) }}
                  selectionnee={grandEcranSelection && feuille?.quoi === 'fil' && feuille.id === f.id}
                />
              ))}
            </ul>
          </CarteListe>
        ) : null}
      </section>

      <div className="mt-[26px]">
        <AccesSupportV2 />
      </div>
    </>
  )

  const confirmationSuppression = aSupprimer && (
    <ConfirmationSuppression
      titre={`Supprimer « ${aSupprimer.title} » ?`}
      texte="Elle disparaît de votre liste. L’équipe garde l’échange, et la conversation revient si elle vous répond."
      enCours={suppressionEnCours}
      erreur={suppressionErreur}
      onConfirmer={confirmerSuppression}
      onClose={() => setASupprimer(null)}
    />
  )

  if (grandEcran) {
    return (
      <div className="flex items-start gap-5 [font-family:var(--font-archivo)]">
        <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
          <ListeReglagesV2 {...liste} selection="reglages" />
        </div>
        <div className="min-w-0 flex-1 text-[color:var(--v2-color-encre)]">
          <FilAriane label="Réglages" href="/dashboard/parametres/reglages" />
          <h1 className={`text-[20px] leading-none ${titre}`}>Aide et assistance</h1>
          <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Une personne de l’équipe vous répond en moins de 24 h.
          </p>

          <div className="mt-5 grid items-start gap-5" style={{ gridTemplateColumns: '300px 1fr' }}>
            <div className="min-w-0">{colonneQuestions(true)}</div>
            <div className="min-w-0 overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
              <PanneauConversationV2
                feuille={feuille}
                filOuvert={filOuvert}
                erreurNouvelle={erreurNouvelle ? { message: erreurNouvelle.message, texte: erreurNouvelle.texte } : null}
                erreurFil={erreurFil ? { message: erreurFil.message, texte: erreurFil.texte } : null}
                onEnvoyerNouvelle={envoyerNouvelle}
                onEnvoyerFil={texte => filOuvert && envoyerQuestion(texte, filOuvert.id)}
              />
            </div>
          </div>
        </div>

        {confirmationSuppression}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
      <div className="flex items-center gap-1 pb-2">
        <Link
          href="/dashboard/parametres"
          aria-label="Retour à Plus"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] leading-none ${titre}`}>Aide et assistance</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Une personne de l’équipe vous répond en moins de 24 h.
          </p>
        </div>
      </div>

      <div className="mt-2">{colonneQuestions(false)}</div>

      {feuille?.quoi === 'nouvelle' && (
        <FeuilleNouvelleQuestionV2
          erreur={erreurNouvelle ? { message: erreurNouvelle.message, texte: erreurNouvelle.texte } : null}
          onEnvoyer={envoyerNouvelle}
          onClose={fermerFeuille}
        />
      )}
      {filOuvert && (
        <FeuilleFilV2
          fil={filOuvert}
          erreur={erreurFil ? { message: erreurFil.message, texte: erreurFil.texte } : null}
          onEnvoyer={texte => envoyerQuestion(texte, filOuvert.id)}
          // Sous la confirmation de suppression, Échap et la poignée ne ferment que la confirmation.
          onClose={aSupprimer ? () => {} : fermerFeuille}
        />
      )}
      {confirmationSuppression}
    </div>
  )
}
