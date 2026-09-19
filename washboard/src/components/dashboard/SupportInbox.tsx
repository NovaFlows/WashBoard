'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, CheckCircle2, RotateCcw, Send, AlertCircle, X } from 'lucide-react'
import { formatSupportDate, type SupportConversationEquipe } from '@/lib/support'
import { logger } from '@/lib/logger'
import { shouldSendOnEnter, estClavierTactile } from '@/lib/composerKeyboard'
import { UnreadCountBadge, unreadLabel } from '@/components/ui/UnreadCountBadge'

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
  erreur,
  onDismissErreur,
}: {
  conv: SupportConversationEquipe
  ouverte: boolean
  onToggle: () => void
  onReply: (texte: string) => void
  onToggleStatus: () => void
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
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ouverte}
        className="w-full flex items-center gap-3 py-3.5 px-1 text-left min-h-11 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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

  const chargerConversations = useCallback(() => {
    return fetch('/api/support/team-questions')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json) throw new Error(json?.error ?? 'Lecture impossible')
        if (!demonte.current) {
          setConversations(cs => fusionnerConversationsAvecServeur(cs, json.conversations, enCoursDeLecture.current))
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
    }
  }, [chargerConversations])

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

  if (conversations.length === 0) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">
        Aucune question en attente.
      </p>
    )
  }

  return (
    <div>
      {trierConversations(conversations).map(conv => (
        <ConversationRow
          key={conv.id}
          conv={conv}
          ouverte={expandedId === conv.id}
          onToggle={() => toggle(conv.id)}
          onReply={t => repondre(conv.id, t)}
          onToggleStatus={() => basculerStatut(conv.id)}
          erreur={erreurs[conv.id]}
          onDismissErreur={() => setErreurs(e => ({ ...e, [conv.id]: undefined }))}
        />
      ))}
    </div>
  )
}
