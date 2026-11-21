import { createAdminClient } from '@/lib/supabase/admin'
import { mentionFranchiseTva, paysFacturation } from '@/lib/facture'
import { notFound } from 'next/navigation'
import { logger } from '@/lib/logger'
import { quotaReservations } from '@/lib/plan'
import { estVerrouillee, seuilsVerrouillage } from '@/lib/reservationsVerrouillees'
import './recu.css'
import { adresseAvecLieu } from '@/lib/centreAuto'
import { libellePrestations } from '@/lib/detailRendezVous'
import { FUSEAU } from '@/lib/dateUtils'
import { getLangue } from '@/lib/i18n/serveur'
import { LOCALES_INTL } from '@/lib/i18n/langues'
import { getT } from '@/lib/i18n/serveur'
import { trans } from '@/lib/i18n/trans'

type Props = { params: Promise<{ id: string }> }

export default async function ConfirmationPage({ params }: Props) {
  const t = await getT()
  const loc = LOCALES_INTL[await getLangue()]
  const { id } = await params

  // Le client qui vient de réserver n'est PAS authentifié, or la RLS interdit la
  // lecture de `bookings` aux non-propriétaires (client anon → permission denied →
  // page introuvable). On lit donc via le service-role, en se limitant à l'id exact
  // (UUID imprévisible = jeton d'accès), jamais une liste.
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, services(name, duration_minutes), washers(name, phone, logo_url)')
    .eq('id', id)
    .single()

  if (!booking) notFound()

  // L'id seul ouvre cette page, et le laveur le voit dans son tableau de bord
  // même pour une réservation au-delà du quota : sans ce contrôle, elle lui
  // rendait nom, téléphone, adresse, heure et prix en clair. Aucun lien
  // distribué ne mène ici (le client passe par l'écran de fin de réservation
  // et les emails, qui pointent vers /pdf) : refuser ne prive aucun client.
  const { data: laveur, error: errLaveur } = await supabase
    .from('washers')
    .select('id, plan, grandfathered, created_at, subscription_status, trial_ends_at, subscription_ends_at, pro_offert_jusqu_au, slug')
    .eq('id', booking.washer_id)
    .single()
  if (errLaveur || !laveur) {
    logger.error('confirmation.washer.read_failed', { bookingId: id }, errLaveur)
    notFound()
  }
  const seuils = await seuilsVerrouillage(supabase, laveur, quotaReservations(laveur))
  if (estVerrouillee(booking, seuils)) notFound()

  const washer  = booking.washers as { name: string; phone: string | null; logo_url: string | null }
  const service = booking.services as { name: string; duration_minutes: number } | null

  const date         = new Date(booking.scheduled_at)
  const formattedDate = date.toLocaleDateString(loc, { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time          = date.toLocaleTimeString(loc, { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })
  const today         = new Date().toLocaleDateString(loc, { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })
  const ref           = booking.id.slice(0, 8).toUpperCase()

  const discount   = Number(booking.smart_discount ?? 0)
  const basePrice  = Number(booking.booked_price ?? 0)
  const finalPrice = booking.is_smart_slot && discount > 0 ? Math.max(0, basePrice - discount) : basePrice
  const finalStr   = Number.isInteger(finalPrice) ? String(finalPrice) : finalPrice.toFixed(2)
  const baseStr    = Number.isInteger(basePrice) ? String(basePrice) : basePrice.toFixed(2)

  return (
    <div className="wb-recu">
      <div className="wb-recu-col">

        {/* Barre d'actions */}
        <div className="no-print wb-recu-barre">
          <p>{t('Confirmation de réservation · Réf.')} <b>{ref}</b></p>
          <a
            href={`/api/bookings/${booking.id}/pdf`}
            download={`confirmation-${ref}.pdf`}
            className="wb-recu-bouton"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            {t('Télécharger PDF')}
          </a>
        </div>

        {/* Document */}
        <div className="wb-recu-doc">
          <div className="wb-recu-kicker">
            <span>{t('Reçu de prestation de service')}</span>
            <b>{t('Réf. {ref}', { ref })}</b>
          </div>

          {/* En-tête */}
          <div className="wb-recu-tete">
            <div>
              {washer.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element -- logo laveur, URL libre
                <img src={washer.logo_url} alt={washer.name} className="wb-recu-logo" />
              )}
              <h1>{washer.name}</h1>
              <p className="wb-recu-doux">{t('Prestataire de nettoyage et d’entretien à domicile')}</p>
              {washer.phone && <p className="wb-recu-doux">{washer.phone}</p>}
            </div>
            <div className="wb-recu-droite">
              <p className="lib">{t('Date d’émission')}</p>
              <p className="val">{today}</p>
              <p className="lib" style={{ marginTop: 12 }}>{t('Référence')}</p>
              <p className="wb-recu-ref">{ref}</p>
            </div>
          </div>

          {/* Prestataire / Client */}
          <div className="wb-recu-parties">
            <div className="wb-recu-partie">
              <p className="lib">{t('Prestataire')}</p>
              <p className="nom">{washer.name}</p>
              {washer.phone && <p className="wb-recu-doux">{washer.phone}</p>}
            </div>
            <div className="wb-recu-partie">
              <p className="lib">{t('Client')}</p>
              <p className="nom">{booking.client_name}</p>
              <p className="wb-recu-doux">{booking.client_email}</p>
              {booking.client_phone && <p className="wb-recu-doux">{booking.client_phone}</p>}
            </div>
          </div>

          {/* Prestation */}
          <div className="wb-recu-lignes">
            <div className="wb-recu-ligne">
              <div>
                <p className="titre">
                  {libellePrestations({ services: service, vehicles_detail: booking.vehicles_detail, selected_addons: booking.selected_addons }, 'Lavage automobile')}
                  {booking.vehicle_type && <span> — {booking.vehicle_type}</span>}
                </p>
                <p className="petit">{formattedDate} à {time}</p>
                <p className="petit">{adresseAvecLieu(booking.address, booking.lieu)}</p>
                {booking.is_smart_slot && discount > 0 && (
                  <p className="promo">{t('★ Créneau optimisé (remise de {discount}€)', { discount })}</p>
                )}
              </div>
              <div className="prix">
                <span className="vh">{t('Montant TTC :')} </span>
                {booking.is_smart_slot && discount > 0 ? (
                  <>
                    <s>{baseStr}€</s>
                    <span className="promo">{finalStr}€</span>
                  </>
                ) : (
                  <>{finalStr}€</>
                )}
              </div>
            </div>
            <p className="wb-recu-tva">{mentionFranchiseTva(paysFacturation({ phone: washer.phone })).replace(/.$/, '')}</p>
          </div>

          <div className="wb-recu-total">
            <span className="lib">{t('Total à régler sur place')}</span>
            <span className="montant">{finalStr}€</span>
          </div>
          <p className="wb-recu-reglement">{t('Mode de règlement : paiement comptant sur place')}</p>

          {/* Encart justificatif */}
          <div className="wb-recu-just">{trans(t, '{e0}Ce document fait office de reçu de prestation de service et peut être utilisé pour une facture. Référence : {e1} · Émis le {e2}', { e0: <b>{t('Justificatif de prestation — facture')}</b>, e1: <strong>{ref}</strong>, e2: today })}</div>

          <div className="wb-recu-pied">{trans(t, 'Ce reçu a été généré automatiquement par {e0} · Plateforme de réservation de prestations à domicile', { e0: <strong>{t('WashBoard')}</strong> })}</div>
        </div>
      </div>
    </div>
  )
}
