'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion'
import { ChevronDown, ChevronLeft, CheckCircle2, RotateCcw, Send, AlertCircle, X, Archive, ArchiveRestore, Undo2 } from 'lucide-react'
import { formatSupportDate, type SupportConversationEquipe } from '@/lib/support'
import { logger } from '@/lib/logger'
import { shouldSendOnEnter, estClavierTactile } from '@/lib/composerKeyboard'
import { DELAI_ANNULATION_ARCHIVAGE_MS, estUnGlissementDArchivage } from '@/lib/supportArchive'
import { UnreadCountBadge, unreadLabel } from '@/components/ui/UnreadCountBadge'
import AccesRapide from '@/components/dashboard/AccesRapide'

/**
 * Même précaution que `fusionnerFilsAvecServeur` côté laveur
 * (`lib/useSupportThreads.ts`) : recale la liste locale sur la réponse d'un
 * GET /api/support/team-questions sans perdre une réponse tout juste
 * envoyée (`repondre`, pas encore confirmée) ni un « vu » posé localement
 * (`toggle`) pendant que le PATCH is_read correspondant n'est pas encore
 * revenu.
 */
export function fusionnerConversationsAvecServeur(
  locales: SupportConversationEquipe[],
  serveur: SupportConversationEquipe[],
  enCoursDeLecture: ReadonlySet<string> = new Set(),
): SupportConversationEquipe[] {
  const idsServeur = new Set(serveur.map(c => c.id))
  const enAttente = locales.filter(c => !idsServeur.has(c.id))
  const connues = serveur.map(c => {
    const locale = locales.find(l => l.id === c.id)
    let conv = c
    if (locale) {
      const idsMessages = new Set(c.messages.map(m => m.id))
      const messagesEnAttente = locale.messages.filter(m => !idsMessages.has(m.id))
      if (messagesEnAttente.length > 0) conv = { ...conv, messages: [...conv.messages, ...messagesEnAttente] }
    }
    if (enCoursDeLecture.has(c.id)) conv = { ...conv, nonLue: false, nonLuesCount: 0 }
    return conv
  })
  return [...enAttente, ...connues]
}

// Boîte de réception de l'équipe support : une conversation par laveur, les
// non lues d'abord. Lue et écrite via /api/support/team-questions* — accès
// réservé à l'équipe (isSupportMember), voir ces routes pour le détail des
// vérifications.
//
// Sobre à dessein : c'est un outil interne, pas une vitrine — pas de cartes
// à ombre ni de couleurs décoratives, juste une liste et un état par ligne.
//
// Archivage réversible (demande de Ryan, 2026-09-20) : bouton discret sur
// chaque ligne + glissement vers la gauche sur mobile, tous deux réversibles
// pendant quelques secondes (voir `archiver`/`confirmerArchivage`), avec une
// vue de récupération séparée (`vue === 'archives'`, ?masques=1) pour un
// archivage remarqué trop tard pour être annulé sur place. Le contrat serveur
// (`hidden: true|false`, `?masques=1`) est celui livré par `dev` — voir
// PATCH/GET /api/support/team-questions[/[id]].

function trierConversations(liste: SupportConversationEquipe[]): SupportConversationEquipe[] {
  return [...liste].sort((a, b) => {
    if (a.nonLue !== b.nonLue) return a.nonLue ? -1 : 1
    if (a.status !== b.status) return a.status === 'ouverte' ? -1 : 1
    const da = a.messages.at(-1)?.createdAt ?? ''
    const db = b.messages.at(-1)?.createdAt ?? ''
    return db.localeCompare(da)
  })
}

function ConversationRow({
  conv,
  ouverte,
  onToggle,
  onReply,
  onToggleStatus,
  onArchive,
  erreur,
  onDismissErreur,
}: {
  conv: SupportConversationEquipe
  ouverte: boolean
  onToggle: () => void
  onReply: (texte: string) => void
  onToggleStatus: () => void
  /** Archivage réversible de CE fil — bouton toujours présent (voir plus bas)
   *  et, sur écran tactile, aussi accessible par glissement vers la gauche. */
  onArchive: () => void
  /** Échec du dernier envoi pour CETTE conversation — texte à restituer et message à afficher. */
  erreur?: { message: string; texte: string } | null
  onDismissErreur: () => void
}) {
  const [texte, setTexte] = useState('')
  const dernier = conv.messages.at(-1)
  // Nombre plutôt que pastille (demande de Ryan, 2026-09-19) : le gras et la
  // teinte de l'avatar suivent désormais ce nombre, jamais l'inverse — un
  // fil affiché en gras et un fil affichant un chiffre sont TOUJOURS le même.
  const nonLuesCount = conv.nonLuesCount ?? 0
  const estNonLu = nonLuesCount > 0

  // -- Glissement vers la gauche (mobile) --------------------------------
  // Même détection que lib/composerKeyboard.ts (`estClavierTactile`, alias
  // volontaire ici : un pointeur fin — souris/trackpad — n'a pas besoin d'un
  // glissement, un doigt si). Évaluée après le montage seulement : `window`
  // n'existe pas côté serveur, et une valeur différente entre le rendu
  // serveur et le premier rendu client casserait l'hydratation.
  const [peutGlisser, setPeutGlisser] = useState(false)
  useEffect(() => setPeutGlisser(estClavierTactile()), [])
  const x = useMotionValue(0)
  const rangeeRef = useRef<HTMLDivElement>(null)

  function surFinDeGlissement(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (estUnGlissementDArchivage(info.offset.x, info.velocity.x)) {
      const largeur = rangeeRef.current?.offsetWidth ?? 400
      animate(x, -largeur, { duration: 0.18, ease: 'easeIn' })
      // Laisse le glissement se terminer visuellement avant de retirer la
      // ligne — sinon la sortie s'interrompt net, coupée par le retrait
      // immédiat du DOM.
      setTimeout(onArchive, 180)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
    }
  }

  // Une réponse qui échoue ne doit pas faire perdre ce qui a été écrit.
  useEffect(() => {
    if (erreur) setTexte(erreur.texte)
  }, [erreur])

  function envoyerTexte() {
    const t = texte.trim()
    if (!t) return
    onReply(t)
    setTexte('')
  }

  function envoyer(e: React.FormEvent) {
    e.preventDefault()
    envoyerTexte()
  }

  // Même règle que côté laveur (voir lib/composerKeyboard.ts) : Entrée envoie,
  // Maj+Entrée saute une ligne, sauf sur clavier tactile où Entrée reste un
  // saut de ligne.
  function surTouche(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldSendOnEnter(e, estClavierTactile())) return
    e.preventDefault()
    envoyerTexte()
  }

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      {/* Hauteur exactement celle de la ligne repliée (jamais celle du
          panneau déplié ci-dessous) : le fond révélé par le glissement et le
          `overflow-hidden` qui le masque au repos doivent rester à cette
          seule hauteur, sous peine de recouvrir les messages une fois la
          ligne ouverte. */}
      <div ref={rangeeRef} className="relative overflow-hidden">
        {peutGlisser && (
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-24 flex flex-col items-center justify-center gap-0.5 bg-slate-600 dark:bg-slate-700 text-white text-[11px] font-semibold"
          >
            <Archive size={16} />
            Archiver
          </div>
        )}
        <motion.div
          style={{ x }}
          drag={peutGlisser ? 'x' : false}
          dragDirectionLock
          dragMomentum={false}
          dragConstraints={{ left: -96, right: 0 }}
          dragElastic={{ left: 0.15, right: 0 }}
          onDragEnd={surFinDeGlissement}
          // `select-none` seulement quand le glissement est actif : sans ça,
          // un doigt qui traîne un peu avant de partir franchement vers la
          // gauche déclenche une sélection de texte native (le nom, l'aperçu)
          // qui vole le geste au lieu de le laisser archiver — jamais
          // souhaitable ici, la ligne n'est pas un endroit où sélectionner du
          // texte. Laissé sélectionnable sur pointeur fin (souris) : rien à
          // protéger là où il n'y a pas de glissement.
          className={`relative bg-white dark:bg-slate-900 flex items-stretch ${peutGlisser ? 'select-none' : ''}`}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={ouverte}
            className="flex-1 min-w-0 flex items-center gap-3 py-3.5 pl-1 pr-1 text-left min-h-11 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <UnreadCountBadge count={conv.nonLuesCount} label={unreadLabel(nonLuesCount)} />
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              estNonLu
                ? 'bg-[#1651E8]/10 text-[#1651E8] dark:bg-[#6A9FFF]/15 dark:text-[#6A9FFF]'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {conv.washerName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`truncate ${estNonLu ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                  {conv.washerName}
                </p>
                <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  conv.status === 'resolue'
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                }`}>
                  {conv.status === 'resolue' ? 'Résolue' : 'Ouverte'}
                </span>
              </div>
              {/* Cet aperçu ne sert qu'à résumer une conversation FERMÉE — une fois
                  dépliée, le même dernier message est déjà visible dans le cadre de
                  conversation juste en dessous (voir plus bas) : l'afficher ici en
                  plus faisait lire deux fois la même phrase à quelques centimètres
                  d'écart (relevé par Ryan, 2026-09-19). */}
              {dernier && !ouverte && (
                // Non lu : l'aperçu passe en gras comme le nom, exactement comme
                // côté laveur (SupportConversation, ListeFils). Sans ça, seul le
                // nom ressortait et le message lui-même restait en gris clair.
                <p className={`text-xs truncate mt-0.5 ${estNonLu ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                  {dernier.from === 'equipe' ? 'Vous : ' : ''}{dernier.text}
                </p>
              )}
            </div>

            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">
              {dernier && formatSupportDate(dernier.createdAt)}
            </span>
            <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${ouverte ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {/* Accès permanent à l'archivage, sur ordinateur ET sur téléphone —
              jamais réservé au glissement : un geste ne doit jamais être le
              SEUL moyen d'atteindre une action (inaccessible au clavier et au
              lecteur d'écran, indécouvrable pour qui ne le devine pas). Discret
              (icône seule, gris, sans bordure) pour ne pas concurrencer
              « Marquer résolue » dans le panneau déplié ci-dessous. */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onArchive() }}
            aria-label={`Archiver la conversation avec ${conv.washerName}`}
            title="Archiver"
            className="shrink-0 my-1.5 mr-1.5 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Archive size={15} />
          </button>
        </motion.div>
      </div>

      {ouverte && (
        <div className="pb-4 px-1 sm:pl-12">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2.5 max-h-72 overflow-y-auto">
            {conv.messages.map((m, i) => {
              const estDernier = i === conv.messages.length - 1
              return (
                <div key={m.id} className={`flex flex-col ${m.from === 'equipe' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    m.from === 'equipe'
                      ? 'bg-[#1651E8] text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                  }`}>
                    <p className="text-sm leading-[1.5] whitespace-pre-wrap">{m.text}</p>
                    <p className={`text-[10px] mt-1 ${m.from === 'equipe' ? 'text-blue-100/80' : 'text-slate-400 dark:text-slate-500'}`}>
                      {formatSupportDate(m.createdAt)}
                    </p>
                  </div>
                  {/* « Vu » : uniquement sous le tout dernier message, s'il
                      est de l'équipe et que le laveur l'a lu. Facile à retirer
                      d'ici seul (ce bloc), sans toucher à la vue laveur
                      (SupportConversation). */}
                  {estDernier && m.from === 'equipe' && conv.vuParLaveur && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 mr-1">Vu</p>
                  )}
                </div>
              )
            })}
          </div>

          {erreur && (
            <div role="alert" className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
              <p className="flex-1 text-xs text-amber-800 dark:text-amber-400 leading-snug">{erreur.message}</p>
              <button
                type="button"
                onClick={onDismissErreur}
                aria-label="Masquer ce message"
                className="shrink-0 -m-1 w-7 h-7 flex items-center justify-center rounded-lg text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={envoyer} className="flex items-end gap-2 mt-3">
            <label htmlFor={`reponse-${conv.id}`} className="sr-only">
              Répondre à {conv.washerName}
            </label>
            <textarea
              id={`reponse-${conv.id}`}
              value={texte}
              onChange={e => {
                setTexte(e.target.value)
                if (erreur) onDismissErreur()
              }}
              onKeyDown={surTouche}
              placeholder={`Répondre à ${conv.washerName}…`}
              rows={2}
              className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1651E8] resize-none"
            />
            <button
              type="submit"
              disabled={!texte.trim()}
              aria-label="Envoyer la réponse"
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[#1651E8] hover:bg-[#0F4ACC] text-white disabled:opacity-40 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>

          <button
            type="button"
            onClick={onToggleStatus}
            className="inline-flex items-center gap-1.5 mt-3 min-h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {conv.status === 'resolue'
              ? <><RotateCcw size={15} /> Rouvrir</>
              : <><CheckCircle2 size={15} /> Marquer résolue</>}
          </button>

          {/* Le laveur qui écrit est souvent celui qu'on veut aider à configurer :
              le lien est déjà connu, un bouton suffit (même route et mêmes verrous que
              le formulaire de la page Support et de l'Assistance). */}
          <AccesRapide slug={conv.washerSlug} nom={conv.washerName} />
        </div>
      )}
    </div>
  )
}

/** Ligne de la vue « fils archivés » — volontairement minimale : ce n'est pas
 *  une vue qu'on ouvre tous les jours, elle sert à retrouver un archivage
 *  remarqué trop tard pour l'« Annuler » de la boîte principale. Pas de
 *  réponse ni de dépli ici, juste de quoi identifier le fil et le
 *  désarchiver. */
function ArchivedRow({
  conv,
  onUnarchive,
  erreur,
  onDismissErreur,
}: {
  conv: SupportConversationEquipe
  onUnarchive: () => void
  erreur?: string
  onDismissErreur: () => void
}) {
  const dernier = conv.messages.at(-1)
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0 py-3 px-1">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500">
          {conv.washerName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-slate-700 dark:text-slate-300">{conv.washerName}</p>
            <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              conv.status === 'resolue'
                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
            }`}>
              {conv.status === 'resolue' ? 'Résolue' : 'Ouverte'}
            </span>
          </div>
          {dernier && (
            <p className="text-xs truncate mt-0.5 text-slate-400 dark:text-slate-500">
              {dernier.from === 'equipe' ? 'Vous : ' : ''}{dernier.text}
            </p>
          )}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">
          {dernier && formatSupportDate(dernier.createdAt)}
        </span>
        <button
          type="button"
          onClick={onUnarchive}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArchiveRestore size={15} /> Désarchiver
        </button>
      </div>
      {erreur && (
        <div role="alert" className="flex items-start gap-2 mt-2 ml-12 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <p className="flex-1 text-xs text-amber-800 dark:text-amber-400 leading-snug">{erreur}</p>
          <button
            type="button"
            onClick={onDismissErreur}
            aria-label="Masquer ce message"
            className="shrink-0 -m-1 w-7 h-7 flex items-center justify-center rounded-lg text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function SupportInbox({ initialConversations = [] }: { initialConversations?: SupportConversationEquipe[] }) {
  const [conversations, setConversations] = useState(initialConversations)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Échec d'une réponse : affiché dans la ligne concernée, jamais en boîte
  // système. Par conversation, pour ne pas mélanger deux réponses en échec
  // en même temps sur deux laveurs différents.
  const [erreurs, setErreurs] = useState<Record<string, { message: string; texte: string } | undefined>>({})

  // true après démontage : le premier chargement et un refetch déclenché par
  // le focus peuvent tous deux répondre après coup.
  const demonte = useRef(false)
  // Conversations ouvertes localement dont le PATCH is_read n'a pas encore
  // répondu — voir `fusionnerConversationsAvecServeur`.
  const enCoursDeLecture = useRef<Set<string>>(new Set())

  // -- Archivage réversible ------------------------------------------------
  // Le fil quitte la liste immédiatement (bouton ou glissement), mais rien
  // n'est écrit côté serveur avant `DELAI_ANNULATION_ARCHIVAGE_MS` : « Annuler »
  // pendant ce délai n'a donc RIEN à défaire côté base, juste à remettre la
  // ligne en place — l'annulation est instantanée et sans risque d'échec
  // réseau. Le contenu exact du fil retiré vit dans `archivagesEnCoursRef`
  // (accès synchrone, pas de closure obsolète dans le `setTimeout`) ; l'état
  // React `archivagesEnAttente` ne sert qu'à afficher les bandeaux « Annuler ».
  const archivagesEnCoursRef = useRef<Map<string, SupportConversationEquipe>>(new Map())
  const minuteursArchivageRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [archivagesEnAttente, setArchivagesEnAttente] = useState<{ id: string; conv: SupportConversationEquipe }[]>([])
  const [erreurArchivage, setErreurArchivage] = useState<string | null>(null)

  // -- Vue « fils archivés » (récupération, pas d'usage quotidien) --------
  const [vue, setVue] = useState<'boite' | 'archives'>('boite')
  const [archives, setArchives] = useState<SupportConversationEquipe[]>([])
  const [archivesChargement, setArchivesChargement] = useState(false)
  const [archivesErreur, setArchivesErreur] = useState<string | null>(null)
  const [desarchivagesErreur, setDesarchivagesErreur] = useState<Record<string, string | undefined>>({})

  const chargerConversations = useCallback(() => {
    return fetch('/api/support/team-questions')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json) throw new Error(json?.error ?? 'Lecture impossible')
        if (!demonte.current) {
          setConversations(cs => {
            const fusion = fusionnerConversationsAvecServeur(cs, json.conversations, enCoursDeLecture.current)
            // Un fil tout juste archivé localement (délai d'annulation encore
            // en cours) est encore visible côté serveur — sans ce filtre, un
            // refetch déclenché par le focus (fenêtre quittée puis reprise
            // pendant les quelques secondes d'« Annuler ») le ferait
            // réapparaître avant même l'écoulement du délai.
            return fusion.filter(c => !archivagesEnCoursRef.current.has(c.id))
          })
        }
      })
      .catch(e => logger.error('support.inbox.load_failed', {}, e))
  }, [])

  useEffect(() => {
    // Même correctif que lib/useSupportThreads.ts : sans cette remise à zéro,
    // le cycle monte→démonte→remonte simulé de React Strict Mode (dev) laisse
    // `demonte.current` bloqué à true et toute réponse après le remontage
    // réel est ignorée, la liste restant vide indéfiniment.
    demonte.current = false
    chargerConversations()
    // Une nouvelle question pendant que la boîte de l'équipe est déjà
    // ouverte, ou le laveur qui vient de lire une réponse (« Vu »), ne doit
    // pas attendre un rechargement de page — le focus couvre le cas réel de
    // deux fenêtres côte à côte. Pas de polling périodique : même raison que
    // côté laveur (lib/useSupportThreads.ts), coût inutile sur un quota
    // Supabase déjà tendu.
    window.addEventListener('focus', chargerConversations)
    return () => {
      demonte.current = true
      window.removeEventListener('focus', chargerConversations)
      // Les minuteurs d'archivage NE sont volontairement PAS annulés ici : un
      // archivage en cours doit aboutir même si l'équipe quitte cette page
      // avant la fin du délai d'annulation (elle a déjà eu sa fenêtre pour
      // dire « Annuler »). `demonte.current` protège juste les mises à jour
      // d'état qui n'ont plus de composant à mettre à jour.
    }
  }, [chargerConversations])

  // Le bandeau « Annuler » occupe le même coin bas-droit que le bouton
  // WhatsApp flottant du tableau de bord (DashboardShell), au même z-index —
  // même conflit, même remède déjà en place pour AssistanceContent et
  // SupportPanel : masquer la bulle via la classe sur <body> plutôt que de
  // déplacer l'un des deux, sous peine de laisser la bulle flotter par-dessus
  // le bandeau et capter le clic destiné à « Annuler ».
  useEffect(() => {
    if (archivagesEnAttente.length === 0) return
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [archivagesEnAttente.length])

  function toggle(id: string) {
    const conv = conversations.find(c => c.id === id)
    setExpandedId(cur => (cur === id ? null : id))
    // Ouvrir une conversation vaut l'avoir vue. Le gras et le badge
    // (ConversationRow) suivent `nonLuesCount`, jamais `nonLue` seul — oublier
    // ce nombre ici laissait la ligne en gras avec son chiffre jusqu'au
    // prochain focus/rechargement (même bug déjà corrigé côté laveur, voir
    // `ouvrirFil` dans lib/useSupportThreads.ts).
    setConversations(cs => cs.map(c => (c.id === id ? { ...c, nonLue: false, nonLuesCount: 0 } : c)))

    if (!conv?.nonLue) return // déjà vue : rien à écrire côté serveur
    enCoursDeLecture.current.add(id)
    fetch(`/api/support/team-questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
      .then(res => {
        if (!res.ok) logger.error('support.inbox.mark_read_failed', { questionId: id, status: res.status })
      })
      .catch(e => logger.error('support.inbox.mark_read_failed', { questionId: id }, e))
      .finally(() => enCoursDeLecture.current.delete(id))
  }

  function repondre(id: string, texte: string) {
    const messageOptimisteId = crypto.randomUUID()
    setErreurs(e => ({ ...e, [id]: undefined })) // une nouvelle tentative efface l'erreur précédente
    setConversations(cs => cs.map(c => c.id === id
      ? { ...c, messages: [...c.messages, { id: messageOptimisteId, from: 'equipe', text: texte, createdAt: new Date().toISOString() }] }
      : c))

    fetch(`/api/support/team-questions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texte }),
    })
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json) throw new Error(json?.error ?? 'Envoi impossible')
        setConversations(cs => cs.map(c => (c.id === id ? json.conversation : c)))
      })
      .catch(e => {
        logger.error('support.inbox.reply_failed', { questionId: id }, e)
        // Le message optimiste ne doit pas laisser croire qu'il est parti.
        setConversations(cs => cs.map(c => (c.id === id
          ? { ...c, messages: c.messages.filter(m => m.id !== messageOptimisteId) }
          : c)))
        setErreurs(errs => ({
          ...errs,
          [id]: { message: 'La réponse n’a pas pu être envoyée. Réessayez.', texte },
        }))
      })
  }

  function basculerStatut(id: string) {
    const conv = conversations.find(c => c.id === id)
    if (!conv) return
    const statutPrecedent = conv.status
    const nouveauStatut = statutPrecedent === 'resolue' ? 'ouverte' : 'resolue'
    setConversations(cs => cs.map(c => (c.id === id ? { ...c, status: nouveauStatut } : c)))

    fetch(`/api/support/team-questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nouveauStatut }),
    })
      .then(res => {
        if (res.ok) return
        logger.error('support.inbox.toggle_status_failed', { questionId: id, status: res.status })
        // L'affichage ne doit pas prétendre un changement qui n'a pas eu lieu.
        setConversations(cs => cs.map(c => (c.id === id ? { ...c, status: statutPrecedent } : c)))
      })
      .catch(e => {
        logger.error('support.inbox.toggle_status_failed', { questionId: id }, e)
        setConversations(cs => cs.map(c => (c.id === id ? { ...c, status: statutPrecedent } : c)))
      })
  }

  /** Étape 1 : retire le fil de la boîte tout de suite (bouton ou glissement)
   *  et ouvre la fenêtre d'annulation — aucun appel réseau ici. */
  function archiver(id: string) {
    const conv = conversations.find(c => c.id === id)
    if (!conv) return
    if (expandedId === id) setExpandedId(null)
    setConversations(cs => cs.filter(c => c.id !== id))
    archivagesEnCoursRef.current.set(id, conv)
    setArchivagesEnAttente(en => [...en, { id, conv }])
    const minuteur = setTimeout(() => confirmerArchivage(id), DELAI_ANNULATION_ARCHIVAGE_MS)
    minuteursArchivageRef.current.set(id, minuteur)
  }

  /** « Annuler » du bandeau : rien n'a encore été écrit côté serveur (voir
   *  `archiver`), il suffit donc d'oublier le minuteur et de remettre le fil
   *  dans la liste — aucune requête, donc aucun échec possible ici. */
  function annulerArchivage(id: string) {
    const minuteur = minuteursArchivageRef.current.get(id)
    if (minuteur) clearTimeout(minuteur)
    minuteursArchivageRef.current.delete(id)
    const conv = archivagesEnCoursRef.current.get(id)
    archivagesEnCoursRef.current.delete(id)
    setArchivagesEnAttente(en => en.filter(a => a.id !== id))
    if (conv) setConversations(cs => [...cs, conv])
  }

  /** Étape 2, après le délai d'annulation : écrit réellement le masquage.
   *  Un échec (503, réseau) remet le fil dans la boîte — jamais de fil
   *  disparu à l'écran alors que la base le dit toujours visible. */
  function confirmerArchivage(id: string) {
    minuteursArchivageRef.current.delete(id)
    const conv = archivagesEnCoursRef.current.get(id)
    archivagesEnCoursRef.current.delete(id)
    setArchivagesEnAttente(en => en.filter(a => a.id !== id))
    if (!conv) return

    fetch(`/api/support/team-questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: true }),
    })
      .then(res => {
        if (res.ok) return
        throw new Error(`archive_failed status=${res.status}`)
      })
      .catch(e => {
        logger.error('support.inbox.archive_failed', { questionId: id }, e)
        if (demonte.current) return
        setConversations(cs => [...cs, conv])
        setErreurArchivage(`La conversation avec ${conv.washerName} n'a pas pu être archivée. Elle reste dans votre boîte de réception. Réessayez.`)
      })
  }

  const chargerArchives = useCallback(() => {
    setArchivesChargement(true)
    setArchivesErreur(null)
    return fetch('/api/support/team-questions?masques=1')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json) throw new Error(json?.error ?? 'Lecture impossible')
        if (!demonte.current) setArchives(json.conversations)
      })
      .catch(e => {
        logger.error('support.inbox.archives_load_failed', {}, e)
        if (!demonte.current) setArchivesErreur('Impossible de charger les fils archivés. Réessayez.')
      })
      .finally(() => {
        if (!demonte.current) setArchivesChargement(false)
      })
  }, [])

  function ouvrirVueArchives() {
    setVue('archives')
    chargerArchives()
  }

  function desarchiver(id: string) {
    const conv = archives.find(c => c.id === id)
    if (!conv) return
    setDesarchivagesErreur(e => ({ ...e, [id]: undefined }))
    setArchives(cs => cs.filter(c => c.id !== id))

    fetch(`/api/support/team-questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: false }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`unarchive_failed status=${res.status}`)
        // La liste « boîte » (`conversations`) n'a jamais entendu parler de ce
        // fil pendant qu'il était masqué : sans ce rechargement, revenir sur
        // « Retour à la boîte de réception » juste après un désarchivage
        // montrerait une boîte inchangée, jusqu'au prochain focus de fenêtre —
        // l'équipe croirait le désarchivage sans effet.
        if (!demonte.current) chargerConversations()
      })
      .catch(e => {
        logger.error('support.inbox.unarchive_failed', { questionId: id }, e)
        if (demonte.current) return
        setArchives(cs => [...cs, conv])
        setDesarchivagesErreur(er => ({
          ...er,
          [id]: `Impossible de désarchiver la conversation avec ${conv.washerName}. Réessayez.`,
        }))
      })
  }

  if (vue === 'archives') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setVue('boite')}
          className="inline-flex items-center gap-1 -ml-1 mb-1 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white min-h-11 px-1"
        >
          <ChevronLeft size={18} /> Retour à la boîte de réception
        </button>

        {archivesErreur && (
          <div role="alert" className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
            <p className="flex-1 text-xs text-amber-800 dark:text-amber-400 leading-snug">{archivesErreur}</p>
            <button
              type="button"
              onClick={chargerArchives}
              className="shrink-0 text-xs font-bold text-amber-800 dark:text-amber-400 underline underline-offset-2"
            >
              Réessayer
            </button>
          </div>
        )}

        {archivesChargement && (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Chargement…</p>
        )}

        {!archivesChargement && !archivesErreur && archives.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Aucun fil archivé.</p>
        )}

        {!archivesChargement && archives.length > 0 && archives.map(conv => (
          <ArchivedRow
            key={conv.id}
            conv={conv}
            onUnarchive={() => desarchiver(conv.id)}
            erreur={desarchivagesErreur[conv.id]}
            onDismissErreur={() => setDesarchivagesErreur(e => ({ ...e, [conv.id]: undefined }))}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {erreurArchivage && (
        <div role="alert" className="flex items-start gap-2 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <p className="flex-1 text-xs text-amber-800 dark:text-amber-400 leading-snug">{erreurArchivage}</p>
          <button
            type="button"
            onClick={() => setErreurArchivage(null)}
            aria-label="Masquer ce message"
            className="shrink-0 -m-1 w-7 h-7 flex items-center justify-center rounded-lg text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {conversations.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">
          Aucune question en attente.
        </p>
      ) : (
        trierConversations(conversations).map(conv => (
          <ConversationRow
            key={conv.id}
            conv={conv}
            ouverte={expandedId === conv.id}
            onToggle={() => toggle(conv.id)}
            onReply={t => repondre(conv.id, t)}
            onToggleStatus={() => basculerStatut(conv.id)}
            onArchive={() => archiver(conv.id)}
            erreur={erreurs[conv.id]}
            onDismissErreur={() => setErreurs(e => ({ ...e, [conv.id]: undefined }))}
          />
        ))
      )}

      {/* Discret : ce n'est pas une vue qu'on ouvre tous les jours, mais elle
          doit rester trouvable — c'est elle qui garantit qu'un archivage par
          erreur remarqué le lendemain (donc après l'« Annuler » ci-dessous)
          reste réparable. */}
      <button
        type="button"
        onClick={ouvrirVueArchives}
        className="w-full flex items-center justify-center gap-1.5 mt-1 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <Archive size={13} aria-hidden /> Fils archivés
      </button>

      {archivagesEnAttente.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-80">
          {archivagesEnAttente.map(a => (
            <div
              key={a.id}
              role="status"
              aria-live="polite"
              className="flex items-center gap-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg shadow-slate-900/20 px-4 py-3"
            >
              <p className="flex-1 text-sm">
                Conversation avec <strong>{a.conv.washerName}</strong> archivée.
              </p>
              <button
                type="button"
                onClick={() => annulerArchivage(a.id)}
                className="shrink-0 inline-flex items-center gap-1 min-h-11 px-2 text-sm font-bold underline decoration-2 underline-offset-2 hover:no-underline"
              >
                <Undo2 size={14} /> Annuler
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
