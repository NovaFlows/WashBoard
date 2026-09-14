import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { prixHt, type FactureContenu } from '@/lib/facture'
import { FUSEAU } from '@/lib/dateUtils'

// Facture d'un laveur à son client, rendue depuis le contenu figé à
// l'émission (`bookings.facture_contenu`) : elle reste identique même si le
// laveur change ensuite d'adresse, de nom ou de prix.

const s = StyleSheet.create({
  page:        { backgroundColor: '#ffffff', fontFamily: 'Helvetica', fontSize: 9.5, color: '#0f172a', padding: 0 },
  topBar:      { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 10 },
  topBarLeft:  { color: '#ffffff', fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },
  topBarRight: { color: '#cbd5e1', fontSize: 10, fontFamily: 'Courier-Bold' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40, paddingTop: 24, paddingBottom: 16 },
  big:         { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  sub:         { fontSize: 9, color: '#475569', marginTop: 2 },
  label:       { fontSize: 7.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  right:       { textAlign: 'right' },
  divider:     { borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0', marginHorizontal: 40 },
  twoCol:      { flexDirection: 'row', marginHorizontal: 40, paddingVertical: 14 },
  col:         { flex: 1 },
  name:        { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  table:       { marginHorizontal: 40, borderWidth: 1, borderColor: '#e2e8f0' },
  row:         { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  head:        { backgroundColor: '#f8fafc', borderBottomColor: '#e2e8f0' },
  headTxt:     { fontSize: 7.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Helvetica-Bold' },
  cDesig:      { flex: 1, paddingRight: 8 },
  cQte:        { width: 34, textAlign: 'right' },
  cPu:         { width: 76, textAlign: 'right' },
  cTot:        { width: 76, textAlign: 'right' },
  totaux:      { marginRight: 40, marginTop: 10, alignSelf: 'flex-end', width: 230 },
  totLigne:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 10 },
  totFinal:    { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  totFinalTxt: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  mentions:    { marginHorizontal: 40, marginTop: 20, fontSize: 8.5, color: '#475569', lineHeight: 1.5 },
  footer:      { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingHorizontal: 40, paddingVertical: 12, marginTop: 'auto' },
  footerTxt:   { fontSize: 7.5, color: '#94a3b8', textAlign: 'center' },
})

// Pas de `toLocaleString` : l'espace fine insécable qu'il insère n'existe pas
// dans la police Helvetica du PDF et s'afficherait comme un caractère cassé.
const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })

type Props = { numero: string; emiseLe: string; contenu: FactureContenu }

export default function FacturePDF({ numero, emiseLe, contenu }: Props) {
  const { vendeur, client, prestation, lignes, remiseTtc, totaux } = contenu
  const franchise = vendeur.regimeTva === 'franchise'
  const ht = (ttc: number) => prixHt(ttc, vendeur.regimeTva, vendeur.tauxTva)
  const taux = String(vendeur.tauxTva).replace('.', ',')

  return (
    <Document title={`Facture ${numero}`} author={vendeur.nomLegal}>
      <Page size="A4" style={s.page}>

        <View style={s.topBar}>
          <Text style={s.topBarLeft}>FACTURE</Text>
          <Text style={s.topBarRight}>N° {numero}</Text>
        </View>

        {/* Vendeur + numéro et date d'émission */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 20 }}>
            <Text style={s.big}>{vendeur.nomCommercial}</Text>
            {vendeur.nomLegal !== vendeur.nomCommercial ? <Text style={s.sub}>{vendeur.nomLegal}</Text> : null}
            <Text style={s.sub}>{vendeur.adresse}</Text>
            <Text style={s.sub}>SIRET : {vendeur.siret}</Text>
            {vendeur.numeroTva ? <Text style={s.sub}>N° TVA intracommunautaire : {vendeur.numeroTva}</Text> : null}
            {vendeur.telephone ? <Text style={s.sub}>{vendeur.telephone}</Text> : null}
          </View>
          <View>
            <Text style={[s.label, s.right]}>Date d&apos;émission</Text>
            <Text style={[{ fontSize: 10, fontFamily: 'Helvetica-Bold' }, s.right]}>{jour(emiseLe)}</Text>
            <Text style={[s.label, s.right, { marginTop: 10 }]}>Numéro</Text>
            <Text style={[{ fontSize: 12, fontFamily: 'Courier-Bold' }, s.right]}>{numero}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Prestation + client */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.label}>Prestation</Text>
            <Text style={s.sub}>{prestation.nature}</Text>
            <Text style={s.sub}>Réalisée le {jour(prestation.date)}</Text>
            <Text style={s.sub}>Lieu d&apos;intervention : {prestation.lieu}</Text>
          </View>
          <View style={[s.col, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9', paddingLeft: 16 }]}>
            <Text style={s.label}>Facturé à</Text>
            {client.entreprise ? <Text style={s.name}>{client.entreprise}</Text> : null}
            <Text style={client.entreprise ? s.sub : s.name}>{client.nom}</Text>
            <Text style={s.sub}>{client.adresseFacturation}</Text>
            {client.siren ? <Text style={s.sub}>SIREN : {client.siren}</Text> : null}
            <Text style={s.sub}>{client.email}</Text>
          </View>
        </View>

        {/* Détail */}
        <View style={s.table}>
          <View style={[s.row, s.head]}>
            <Text style={[s.headTxt, s.cDesig]}>Désignation</Text>
            <Text style={[s.headTxt, s.cQte]}>Qté</Text>
            <Text style={[s.headTxt, s.cPu]}>{franchise ? 'Prix unit.' : 'Prix unit. HT'}</Text>
            <Text style={[s.headTxt, s.cTot]}>{franchise ? 'Montant' : 'Total HT'}</Text>
          </View>
          {lignes.map((l, i) => (
            <View key={i} style={s.row}>
              <Text style={s.cDesig}>{l.designation}</Text>
              <Text style={s.cQte}>{l.quantite}</Text>
              <Text style={s.cPu}>{euros(ht(l.prixUnitaireTtc))}</Text>
              <Text style={s.cTot}>{euros(ht(l.totalTtc))}</Text>
            </View>
          ))}
          {remiseTtc > 0 ? (
            <View style={s.row}>
              <Text style={s.cDesig}>Remise créneau optimisé</Text>
              <Text style={s.cQte}>1</Text>
              <Text style={s.cPu}>{euros(-ht(remiseTtc))}</Text>
              <Text style={s.cTot}>{euros(-ht(remiseTtc))}</Text>
            </View>
          ) : null}
        </View>

        {/* Totaux */}
        <View style={s.totaux}>
          {franchise ? null : (
            <>
              <View style={s.totLigne}><Text>Total HT</Text><Text>{euros(totaux.ht)}</Text></View>
              <View style={s.totLigne}><Text>TVA {taux} %</Text><Text>{euros(totaux.tva)}</Text></View>
            </>
          )}
          <View style={s.totFinal}>
            <Text style={s.totFinalTxt}>{franchise ? 'Total à payer' : 'Total TTC'}</Text>
            <Text style={s.totFinalTxt}>{euros(totaux.ttc)}</Text>
          </View>
        </View>

        {/* Mentions obligatoires */}
        <View style={s.mentions}>
          {franchise ? <Text>TVA non applicable, art. 293 B du CGI.</Text> : null}
          <Text>Paiement comptant le jour de la prestation. Pas d&apos;escompte pour paiement anticipé.</Text>
          {client.professionnel ? (
            <Text>
              En cas de retard de paiement : pénalités au taux de trois fois le taux d&apos;intérêt légal,
              et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).
            </Text>
          ) : null}
        </View>

        <View style={s.footer}>
          <Text style={s.footerTxt}>Facture émise via WashBoard pour le compte de {vendeur.nomLegal}</Text>
        </View>

      </Page>
    </Document>
  )
}
