'use client'

import { createPortal } from 'react-dom'

/** La validation reste dans l'étape ; seul son bouton est rendu dans la barre fixe. */
export default function BookingAction({ target, disabled, onClick, children, accent = '#2563eb' }: {
  target: HTMLElement | null
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
  accent?: string
}) {
  if (!target) return null
  return createPortal(
    <button type="button" data-testid="booking-continue" disabled={disabled} onClick={onClick}
      className="wb-booking-continue" style={{ backgroundColor: disabled ? undefined : accent }}>
      {children}
    </button>, target,
  )
}
