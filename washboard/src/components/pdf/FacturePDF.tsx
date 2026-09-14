import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { prixHt, type FactureContenu } from '@/lib/facture'
import { FUSEAU } from '@/lib/dateUtils'

// Facture d'un laveur à son client, rendue depuis le contenu figé à
// l'émission (`bookings.facture_contenu`) : elle reste identique même si le
// laveur change ensuite d'adresse, de nom ou de prix.
//
// Mise en page volontairement classique — celle d'une facture d'artisan :
// papier blanc, une seule couleur (celle de la marque du laveur, sur un filet),
// pas de bandeaux ni de titres en capitales espacées.

const ENCRE = '#1e293b'
const GRIS = '#64748b'
const FILET = '#e2e8f0'

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9.5, color: ENCRE, paddingTop: 44, paddingBottom: 72, paddingHorizontal: 48, lineHeight: 1.35 },
  entete:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  identite:    { flexDirection: 'row', alignItems: 'flex-start', flex: 1, paddingRight: 24 },
  logo:        { width: 56, height: 56, objectFit: 'contain', marginRight: 14 },
  nom:         { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  ligne:       { fontSize: 8.5, color: GRIS },
  titre:       { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'right', lineHeight: 1, marginBottom: 10 },
  meta:        { fontSize: 9, color: GRIS, textAlign: 'right', marginTop: 1 },
  metaFort:    { fontFamily: 'Helvetica-Bold', color: ENCRE },
  accent:      { height: 2, marginTop: 20, marginBottom: 22 },
  blocs:       { flexDirection: 'row', marginBottom: 26 },
  bloc:        { flex: 1, paddingRight: 16 },
  etiquette:   { fontSize: 8.5, color: GRIS, marginBottom: 5 },
  fort:        { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 2 },
  tete:        { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: ENCRE },
  teteTxt:     { fontSize: 8.5, color: GRIS },
  rang:        { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: FILET },
  cDesig:      { flex: 1, paddingRight: 8 },
  cQte:        { width: 32, textAlign: 'right' },
  cPu:         { width: 80, textAlign: 'right' },
  cTot:        { width: 80, textAlign: 'right' },
  totaux:      { alignSelf: 'flex-end', width: 220, marginTop: 12 },
  totRang:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totFinal:    { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: ENCRE, paddingTop: 6, marginTop: 4 },
  totFinalTxt: { fontFamily: 'Helvetica-Bold', fontSize: 11.5 },
  mentions:    { marginTop: 34, fontSize: 8, color: GRIS, lineHeight: 1.55 },
  pied:        { position: 'absolute', bottom: 30, left: 48, right: 48, fontSize: 7.5, color: '#94a3b8', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: FILET, paddingTop: 8 },
})

// Pas de `toLocaleString` : l'espace fine insécable qu'il insère n'existe pas
// dans la police Helvetica du PDF et s'afficherait comme un caractère cassé.
const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })

type Props = { numero: string; emiseLe: string; contenu: FactureContenu; logo?: Buffer | null }

export default function FacturePDF({ numero, emiseLe, contenu, logo }: Props) {
  const { vendeur, client, prestation, lignes, remiseTtc, totaux } = contenu
  const franchise = vendeur.regimeTva === 'franchise'
  const ht = (ttc: number) => prixHt(ttc, vendeur.regimeTva, vendeur.tauxTva)
  const taux = String(vendeur.tauxTva).replace('.', ',')
  const couleur = vendeur.couleur && /^#[0-9a-f]{6}$/i.test(vendeur.couleur) ? vendeur.couleur : ENCRE
  const mentionsSociete = vendeur.statut === 'societe'
    ? [vendeur.formeJuridique, vendeur.capital ? `au capital de ${vendeur.capital}` : null, vendeur.immatriculation]
        .filter(Boolean).join(' · ')
    : ''

  return (
    <Document title={`Facture ${numero}`} author={vendeur.nomLegal}>
      <Page size="A4" style={s.page}>

        {/* Laveur à gauche, numéro et date à droite */}
        <View style={s.entete}>
          <View style={s.identite}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- image d'un PDF, sans attribut alt */}
            {logo ? <Image style={s.logo} src={{ data: logo, format: 'png' }} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={s.nom}>{vendeur.nomCommercial}</Text>
              {vendeur.nomLegal !== vendeur.nomCommercial ? <Text style={s.ligne}>{vendeur.nomLegal}</Text> : null}
              {mentionsSociete ? <Text style={s.ligne}>{mentionsSociete}</Text> : null}
              <Text style={s.ligne}>{vendeur.adresse}</Text>
              <Text style={s.ligne}>SIRET {vendeur.siret}</Text>
              {vendeur.numeroTva ? <Text style={s.ligne}>TVA intracommunautaire {vendeur.numeroTva}</Text> : null}
              {vendeur.telephone ? <Text style={s.ligne}>{vendeur.telephone}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.titre}>Facture</Text>
            <Text style={s.meta}>N° <Text style={s.metaFort}>{numero}</Text></Text>
            <Text style={s.meta}>Émise le {jour(emiseLe)}</Text>
          </View>
        </View>

        <View style={[s.accent, { backgroundColor: couleur }]} />

        {/* Client et prestation */}
        <View style={s.blocs}>
          <View style={s.bloc}>
            <Text style={s.etiquette}>Facturé à</Text>
            {client.entreprise ? <Text style={s.fort}>{client.entreprise}</Text> : null}
            <Text style={client.entreprise ? {} : s.fort}>{client.nom}</Text>
            <Text>{client.adresseFacturation}</Text>
            {client.siren ? <Text>SIREN {client.siren}</Text> : null}
            <Text style={{ color: GRIS }}>{client.email}</Text>
          </View>
          <View style={s.bloc}>
            <Text style={s.etiquette}>Prestation</Text>
            <Text>{prestation.nature}</Text>
            <Text>Le {jour(prestation.date)} à {heure(prestation.date)}</Text>
            <Text>{prestation.lieu}</Text>
          </View>
        </View>

        {/* Détail */}
        <View style={s.tete}>
          <Text style={[s.teteTxt, s.cDesig]}>Désignation</Text>
          <Text style={[s.teteTxt, s.cQte]}>Qté</Text>
          <Text style={[s.teteTxt, s.cPu]}>{franchise ? 'Prix unitaire' : 'Prix unitaire HT'}</Text>
          <Text style={[s.teteTxt, s.cTot]}>{franchise ? 'Montant' : 'Montant HT'}</Text>
        </View>
        {lignes.map((l, i) => (
          <View key={i} style={s.rang}>
            <Text style={s.cDesig}>{l.designation}</Text>
            <Text style={s.cQte}>{l.quantite}</Text>
            <Text style={s.cPu}>{euros(ht(l.prixUnitaireTtc))}</Text>
            <Text style={s.cTot}>{euros(ht(l.totalTtc))}</Text>
          </View>
        ))}
        {remiseTtc > 0 ? (
          <View style={s.rang}>
            <Text style={s.cDesig}>Remise créneau optimisé</Text>
            <Text style={s.cQte}>1</Text>
            <Text style={s.cPu}>{euros(-ht(remiseTtc))}</Text>
            <Text style={s.cTot}>{euros(-ht(remiseTtc))}</Text>
          </View>
        ) : null}

        {/* Totaux */}
        <View style={s.totaux}>
          {franchise ? null : (
            <>
              <View style={s.totRang}><Text>Total HT</Text><Text>{euros(totaux.ht)}</Text></View>
              <View style={s.totRang}><Text>TVA {taux} %</Text><Text>{euros(totaux.tva)}</Text></View>
            </>
          )}
          <View style={s.totFinal}>
            <Text style={s.totFinalTxt}>{franchise ? 'Total' : 'Total TTC'}</Text>
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

        <Text style={s.pied} fixed>
          {vendeur.nomLegal} · SIRET {vendeur.siret} · {vendeur.adresse}
        </Text>

      </Page>
    </Document>
  )
}
