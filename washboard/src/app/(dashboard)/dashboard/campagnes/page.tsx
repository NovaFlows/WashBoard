import { redirect } from 'next/navigation'

/** Les publicités ont rejoint le CRM, en onglet.
 *
 *  L'adresse est conservée plutôt que supprimée : elle est peut-être déjà dans
 *  un favori, un e-mail d'annonce ou une capture d'écran envoyée à un laveur.
 *  Une redirection permanente coûte un fichier de quatre lignes ; un 404 coûte
 *  un appel au support.
 *
 *  Pourquoi le déplacement : les campagnes répondent à la même question que le
 *  reste du CRM — « d'où viennent mes clients » — et les deux écrans se lisent
 *  l'un contre l'autre. Séparés, le laveur comparait de tête le trafic de sa
 *  publicité au trafic de sa page, en changeant de page entre les deux. */
export default function CampagnesPage() {
  redirect('/dashboard/crm?onglet=campagnes')
}
