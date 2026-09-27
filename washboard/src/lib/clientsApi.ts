// Appel de la Fiche client (PWA) à `/api/clients/[cle]`. Même contrat d'erreur que
// `prestationsApi`/`documentsApi` : une phrase claire du serveur pour un refus, une simple
// référence pour une panne.

import { appeler, type ResultatApi } from '@/lib/prestationsApi'

/** Dit qu'un client ne veut plus être contacté — ou revient dessus. C'est ce seul réglage qui
 *  exclut le client des crons de relance et de demande d'avis (voir `send-followups`,
 *  `send-reviews`). `cle` : voir `cleClient`, encodée pour l'URL. */
export async function marquerNePlusContacter(cle: string, nePlusContacter: boolean): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/clients/${encodeURIComponent(cle)}`, { nePlusContacter })
  return r.ok ? { ok: true, data: null } : r
}
