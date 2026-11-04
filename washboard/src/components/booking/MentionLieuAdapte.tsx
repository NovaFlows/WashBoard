import { MESSAGE_LIEU_ADAPTE, afficherMentionLieuAdapte } from '@/lib/lieuAdapte'

/** Simple information : rien à cocher, ne bloque pas la réservation. */
export default function MentionLieuAdapte({ service, auCentre, className = '' }: {
  service: { lieu_adapte?: boolean }
  auCentre: boolean
  className?: string
}) {
  if (!afficherMentionLieuAdapte(service, auCentre)) return null
  return (
    <span className={`flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-snug ${className}`} data-testid="mention-lieu-adapte">
      <svg className="mt-px h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </svg>
      <span>{MESSAGE_LIEU_ADAPTE}</span>
    </span>
  )
}
