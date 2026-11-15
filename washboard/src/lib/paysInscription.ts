import type { PaysTelephone } from '@/lib/phone'

// Pays ouverts à l'inscription (2026-11-14).
//
// Le Luxembourg et le Québec sont CODÉS (téléphone, profil de facturation), mais ils ne s'ouvrent
// pas tout seuls : le code de confirmation arrive par SMS, et rien ne prouve encore que Brevo le
// livre là-bas (expéditeur « WashBoard » en lettres, refusé en Amérique du Nord ; pays à activer
// dans le compte). Un pays ouvert trop tôt enfermerait ses inscrits devant un code qui n'arrive pas.
//
// Une variable d'environnement les allume, sans nouveau déploiement de code :
//   NEXT_PUBLIC_PAYS_INSCRIPTION = FR,BE,CH,LU      (liste séparée par des virgules)
// Elle est publique (préfixe NEXT_PUBLIC_) parce que la page d'inscription en a besoin pour
// n'afficher que ces pays ; le serveur lit la même, et refuse les autres. Absente : FR, BE, CH.
// La valeur est lue au DÉPLOIEMENT : après l'avoir changée, il faut redéployer.

export const PAYS_OUVERTS_PAR_DEFAUT: readonly PaysTelephone[] = ['FR', 'BE', 'CH', 'LU']
// Le Québec est codé (téléphone, facturation) mais PAS ouvrable, même par la variable d'environnement :
// le fuseau de l'appli est celui de Paris dans une cinquantaine de fichiers (6 h de décalage au Québec :
// créneaux, rappels et jours qui basculent faux). À ajouter ici quand le fuseau sera par laveur.
const CONNUS: readonly PaysTelephone[] = ['FR', 'BE', 'CH', 'LU']

/** Les pays ouverts à l'inscription. La France y est toujours : on ne ferme pas le pays d'origine. */
export function paysOuverts(valeur: string | undefined = process.env.NEXT_PUBLIC_PAYS_INSCRIPTION): PaysTelephone[] {
  const demandes = String(valeur ?? '')
    .split(',')
    .map(p => p.trim().toUpperCase())
    .filter((p): p is PaysTelephone => (CONNUS as readonly string[]).includes(p))
  const liste = demandes.length > 0 ? demandes : [...PAYS_OUVERTS_PAR_DEFAUT]
  return [...new Set<PaysTelephone>(['FR', ...liste])]
}
