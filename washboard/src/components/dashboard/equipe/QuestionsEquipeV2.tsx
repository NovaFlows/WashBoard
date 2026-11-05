'use client'

import SupportInbox from '@/components/dashboard/SupportInbox'
import EcranEquipe from './EcranEquipe'

export default function QuestionsEquipeV2() {
  return (
    <EcranEquipe titre="Questions des laveurs" sousTitre="Les non lues en premier" retour={{ href: '/dashboard/support', label: 'Équipe' }}>
      <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4">
        <SupportInbox />
      </div>
    </EcranEquipe>
  )
}
