'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useSupportThreads } from '@/lib/useSupportThreads'
import { useLigneGlissante, LARGEUR_ACTION_PX } from '@/hooks/useLigneGlissante'
import { BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe, Chevron } from '@/components/dashboard/ParametresFormV2'
import { ConfirmationSuppression, nom } from '@/components/dashboard/PrestationsUiV2'
import { FeuilleFilV2, FeuilleNouvelleQuestionV2 } from '@/components/dashboard/FeuillesAssistanceV2'
import AccesSupportV2 from '@/components/dashboard/AccesSupportV2'
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
  fil, ouverte, onOuvrirLigne, onFermerLigne, onOuvrir, onSupprimer,
}: {
  fil: SupportThread
  ouverte: boolean
  onOuvrirLigne: () => void
  onFermerLigne: () => void
  onOuvrir: () => void
  onSupprimer: () => void
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
      <div {...poignee} style={styleContenu} className="bg-[color:var(--v2-color-surface)] motion-reduce:!transition-none">
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

export default function AssistanceV2() {
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

      <div className="mt-2">
        <CarteListe>
          <Link href="/dashboard/guide" className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={`text-[15.5px] ${nom}`}>Guide d’utilisation</span>
              <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Chercher une réponse par vous-même</span>
            </span>
            <Chevron />
          </Link>
        </CarteListe>
      </div>

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
                />
              ))}
            </ul>
          </CarteListe>
        ) : null}
      </section>

      <div className="mt-[26px]">
        <AccesSupportV2 />
      </div>

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
      {aSupprimer && (
        <ConfirmationSuppression
          titre={`Supprimer « ${aSupprimer.title} » ?`}
          texte="Elle disparaît de votre liste. L’équipe garde l’échange, et la conversation revient si elle vous répond."
          enCours={suppressionEnCours}
          erreur={suppressionErreur}
          onConfirmer={confirmerSuppression}
          onClose={() => setASupprimer(null)}
        />
      )}
    </div>
  )
}
