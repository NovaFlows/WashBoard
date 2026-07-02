import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'

const s = StyleSheet.create({
  page:        { backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a', padding: 0 },
  topBar:      { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 8 },
  topBarLeft:  { color: '#94a3b8', fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
  topBarRight: { color: '#64748b', fontSize: 9, fontFamily: 'Courier' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 40, paddingTop: 28, paddingBottom: 20 },
  washerName:  { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 3 },
  subText:     { fontSize: 10, color: '#64748b', marginTop: 2 },
  labelSmall:  { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  divider:     { borderBottomWidth: 2, borderBottomColor: '#e2e8f0', marginHorizontal: 40 },
  twoCol:      { flexDirection: 'row', marginHorizontal: 40, paddingVertical: 16 },
  col:         { flex: 1 },
  colName:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 3 },
  table:       { marginHorizontal: 40, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4 },
  tableHead:   { backgroundColor: '#f8fafc', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHeadTxt:{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: 'Helvetica-Bold' },
  tableRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableMeta:   { backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableFooter: { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  totalLabel:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  totalPrice:  { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  badge:       { marginHorizontal: 40, marginBottom: 20, backgroundColor: '#eff6ff', borderLeftWidth: 4, borderLeftColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 12 },
  badgeTitle:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 3 },
  badgeText:   { fontSize: 9, color: '#3b82f6', lineHeight: 1.4 },
  footer:      { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingHorizontal: 40, paddingVertical: 14, marginTop: 'auto' },
  footerText:  { fontSize: 8, color: '#94a3b8', textAlign: 'center' },
  priceStrike: { fontSize: 10, color: '#94a3b8', textDecoration: 'line-through' },
  priceMain:   { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  priceAmber:  { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#d97706' },
  rightAlign:  { textAlign: 'right' },
  payNote:     { marginHorizontal: 40, marginBottom: 16, fontSize: 9, color: '#94a3b8', textAlign: 'right' },
})

type Props = {
  booking: {
    id: string
    client_name: string
    client_email: string
    client_phone: string | null
    address: string
    scheduled_at: string
    is_smart_slot: boolean
    smart_discount: number
    booked_price: number | null
    vehicle_count: number
    is_professional: boolean
    company_name: string | null
    siret: string | null
    billing_address: string | null
    services: { name: string } | null
    washers: { name: string; phone: string | null } | null
    vehicles_detail?: { type: string; count: number; unit_price: number; label?: string; models?: string[] }[] | null
  }
}

export default function BookingPDF({ booking }: Props) {
  const washer  = booking.washers
  const service = booking.services

  const date         = new Date(booking.scheduled_at)
  const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time          = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const today         = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const ref           = booking.id.slice(0, 8).toUpperCase()

  const count           = booking.vehicle_count ?? 1
  const discount        = Number(booking.smart_discount ?? 0)
  const totalPrice      = Number(booking.booked_price ?? 0)
  const unitPrice       = count > 1 ? totalPrice / count : totalPrice
  const finalPrice      = booking.is_smart_slot && discount > 0 ? Math.max(0, totalPrice - discount) : totalPrice
  const finalStr        = Number.isInteger(finalPrice) ? String(finalPrice) : finalPrice.toFixed(2)
  const unitStr         = Number.isInteger(unitPrice) ? String(unitPrice) : unitPrice.toFixed(2)
  const baseStr         = Number.isInteger(totalPrice) ? String(totalPrice) : totalPrice.toFixed(2)
  const vehiclesDetail  = booking.vehicles_detail ?? null
  const isMultiVehicle  = vehiclesDetail && vehiclesDetail.length > 1

  return (
    <Document title={`Confirmation de réservation ${ref}`} author="WashBoard">
      <Page size="A4" style={s.page}>

        {/* Barre supérieure */}
        <View style={s.topBar}>
          <Text style={s.topBarLeft}>Reçu de prestation de service</Text>
          <Text style={s.topBarRight}>Réf. {ref}</Text>
        </View>

        {/* En-tête */}
        <View style={s.header}>
          <View>
            <Text style={s.washerName}>{washer?.name ?? ''}</Text>
            <Text style={s.subText}>Prestataire de lavage automobile à domicile</Text>
            {washer?.phone && <Text style={s.subText}>{washer.phone}</Text>}
          </View>
          <View>
            <Text style={[s.labelSmall, s.rightAlign]}>Date d&apos;émission</Text>
            <Text style={[{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#475569' }, s.rightAlign]}>{today}</Text>
            <View style={{ marginTop: 10, backgroundColor: '#f1f5f9', borderRadius: 4, padding: 8, alignItems: 'flex-end' }}>
              <Text style={s.labelSmall}>Référence</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Courier-Bold', color: '#0f172a' }}>{ref}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Prestataire / Client */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.labelSmall}>Prestataire</Text>
            <Text style={s.colName}>{washer?.name ?? ''}</Text>
            {washer?.phone && <Text style={s.subText}>{washer.phone}</Text>}
          </View>
          <View style={[s.col, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9', paddingLeft: 20 }]}>
            <Text style={s.labelSmall}>{booking.is_professional ? 'Client (Professionnel)' : 'Client'}</Text>
            {booking.is_professional && booking.company_name && (
              <Text style={[s.colName, { marginBottom: 2 }]}>{booking.company_name}</Text>
            )}
            {booking.is_professional && booking.siret && (
              <Text style={{ fontSize: 9, color: '#64748b', fontFamily: 'Courier', marginBottom: 4 }}>SIRET : {booking.siret}</Text>
            )}
            <Text style={booking.is_professional ? s.subText : s.colName}>{booking.client_name}</Text>
            <Text style={s.subText}>{booking.client_email}</Text>
            {booking.client_phone && <Text style={s.subText}>{booking.client_phone}</Text>}
            {booking.is_professional && booking.billing_address && (
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>Facturation : {booking.billing_address}</Text>
            )}
          </View>
        </View>

        {/* Tableau */}
        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={s.tableHeadTxt}>Désignation</Text>
            <Text style={s.tableHeadTxt}>Montant TTC</Text>
          </View>

          <View style={s.tableRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
                {service?.name ?? 'Lavage automobile'}
                {!isMultiVehicle && count > 1 ? ` × ${count} véhicules` : ''}
              </Text>
              {!isMultiVehicle && count > 1 && (
                <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{unitStr}€/véhicule × {count}</Text>
              )}
              <Text style={s.subText}>{formattedDate} à {time}</Text>
              <Text style={s.subText}>{booking.address}</Text>
              {booking.is_smart_slot && discount > 0 && (
                <Text style={{ fontSize: 9, color: '#d97706', fontFamily: 'Helvetica-Bold', marginTop: 4 }}>
                  ★ Créneau optimisé (remise de {discount}€)
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 20 }}>
              {booking.is_smart_slot && discount > 0 ? (
                <>
                  <Text style={s.priceStrike}>{baseStr}€</Text>
                  <Text style={s.priceAmber}>{finalStr}€</Text>
                </>
              ) : (
                <Text style={s.priceMain}>{finalStr}€</Text>
              )}
            </View>
          </View>

          {isMultiVehicle && vehiclesDetail!.map((item, i) => {
            const lineTotal = item.unit_price * item.count
            const lineTotalStr = Number.isInteger(lineTotal) ? String(lineTotal) : lineTotal.toFixed(2)
            const label = item.label ?? VEHICLE_LABELS[item.type] ?? item.type
            const mdls = (item.models ?? []).map(m => m.trim()).filter(Boolean)
            return (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, paddingLeft: 28, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ fontSize: 10, color: '#475569' }}>{label} × {item.count}{mdls.length ? ` — ${mdls.join(', ')}` : ''}  ({item.unit_price}€/véh)</Text>
                <Text style={{ fontSize: 10, color: '#475569' }}>{lineTotalStr}€</Text>
              </View>
            )
          })}

          <View style={s.tableMeta}>
            <Text style={{ fontSize: 8, color: '#94a3b8', fontStyle: 'italic' }}>TVA non applicable — art. 293 B du CGI</Text>
          </View>

          <View style={s.tableFooter}>
            <Text style={s.totalLabel}>TOTAL À RÉGLER SUR PLACE</Text>
            <Text style={s.totalPrice}>{finalStr}€</Text>
          </View>
        </View>

        <Text style={s.payNote}>Mode de règlement : paiement comptant sur place</Text>

        {/* Encart facture */}
        <View style={s.badge}>
          <Text style={s.badgeTitle}>Justificatif de prestation — facture</Text>
          <Text style={s.badgeText}>
            Ce document fait office de reçu de prestation de service et peut être utilisé pour une facture.{'\n'}
            Référence : {ref} · Émis le {today}
          </Text>
        </View>

        {/* Pied de page */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Ce reçu a été généré automatiquement par WashBoard · Plateforme de réservation de lavage automobile à domicile
          </Text>
        </View>

      </Page>
    </Document>
  )
}
