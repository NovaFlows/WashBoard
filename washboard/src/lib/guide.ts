// Contenu du guide d'aide (espace connecté).
//
// Le texte est stocké ici plutôt qu'en JSX pour deux raisons : la recherche
// porte sur la chaîne brute, et les liens internes s'écrivent en ligne au
// format [libellé](/dashboard/xxx) — c'est ce qui produit les mots en bleu
// qui renvoient vers la bonne page.

export type GuideEntry = {
  id: string
  question: string
  /** Texte de la réponse. Liens en ligne : [libellé](/chemin) */
  answer: string
  /** Mots-clés supplémentaires pour la recherche (synonymes, fautes courantes). */
  keywords?: string[]
}

export type GuideSection = {
  id: string
  title: string
  summary: string
  entries: GuideEntry[]
}

export const GUIDE: GuideSection[] = [
  {
    id: 'demarrage',
    title: 'Démarrage',
    summary: 'Les trois choses à faire avant de partager votre lien.',
    entries: [
      {
        id: 'premiers-pas',
        question: 'Par où commencer ?',
        answer:
          "Trois étapes, dans cet ordre. D'abord renseignez votre identité et votre logo dans [Réglages de la page](/dashboard/admin). Ensuite créez vos prestations et vos tarifs, toujours au même endroit, onglet Prestations. Enfin définissez vos horaires de travail dans l'onglet Disponibilités. Une fois ces trois points faits, votre page de réservation est prête à être partagée.",
        keywords: ['debuter', 'commencer', 'configuration', 'installation'],
      },
      {
        id: 'lien-reservation',
        question: 'Où trouver mon lien de réservation ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), carte « Votre lien de réservation ». Vous pouvez y modifier la fin de l'adresse pour qu'elle porte le nom de votre activité. C'est ce lien que vous mettez dans votre fiche Google, votre bio Instagram et vos messages : vos clients réservent sans avoir à créer de compte.",
        keywords: ['url', 'adresse', 'slug', 'partager', 'lien client'],
      },
      {
        id: 'tester-page',
        question: 'Comment vérifier ce que voient mes clients ?',
        answer:
          "Ouvrez votre lien de réservation dans un onglet privé de votre navigateur : vous verrez exactement la page telle qu'un client la découvre. Pensez à le refaire après chaque changement de tarifs ou d'horaires.",
        keywords: ['apercu', 'preview', 'voir', 'verifier'],
      },
    ],
  },
  {
    id: 'page-reservation',
    title: 'Page de réservation',
    summary: 'Ce que vos clients voient, et comment le personnaliser.',
    entries: [
      {
        id: 'prestations',
        question: 'Comment créer mes prestations et mes tarifs ?',
        answer:
          "Dans [Réglages de la page](/dashboard/admin), onglet Prestations. Chaque prestation a un nom, une durée et un prix. Vous pouvez définir un prix différent selon le type de véhicule : une citadine et un SUV ne demandent pas le même temps, le tarif doit le refléter. Les options supplémentaires se paramètrent au même endroit.",
        keywords: ['prix', 'tarif', 'service', 'prestation', 'duree', 'option', 'vehicule'],
      },
      {
        id: 'personnalisation',
        question: 'Comment mettre mon logo et mes couleurs ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), carte « Personnalisation de la page client » pour le thème et la couleur d'accent, et dans [Réglages de la page](/dashboard/admin), onglet Identité, pour le logo et le message d'accueil. Le logo sert aussi d'icône dans l'onglet du navigateur de vos clients.",
        keywords: ['logo', 'couleur', 'theme', 'personnaliser', 'identite', 'marque'],
      },
      {
        id: 'zones',
        question: 'Comment limiter ma zone d’intervention ?',
        answer:
          "Dans [Réglages de la page](/dashboard/admin), onglet Identité, indiquez votre adresse de départ et le rayon que vous acceptez. Une adresse hors zone est refusée automatiquement, avant même que le client ne choisisse un créneau. Vous pouvez aussi facturer des frais de déplacement au-delà d'une certaine distance.",
        keywords: ['zone', 'rayon', 'perimetre', 'distance', 'deplacement', 'frais', 'km'],
      },
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda et rendez-vous',
    summary: 'Confirmer, terminer, bloquer des journées.',
    entries: [
      {
        id: 'confirmer',
        question: 'Comment confirmer un rendez-vous ?',
        answer:
          "Une nouvelle réservation arrive en « en attente ». Ouvrez-la dans le [Calendrier](/dashboard/calendrier) et confirmez-la : votre client reçoit alors un email de confirmation. C'est aussi à ce moment que le rendez-vous est ajouté à votre Google Agenda, si vous l'avez connecté.",
        keywords: ['confirmer', 'valider', 'en attente', 'accepter', 'agenda google'],
      },
      {
        id: 'terminer',
        question: 'Que se passe-t-il quand je marque un RDV « terminé » ?',
        answer:
          "C'est l'action qui déclenche tout le suivi. Le chiffre d'affaires est comptabilisé dans la [Comptabilité](/dashboard/compta), et la demande d'avis Google part automatiquement après le délai que vous avez choisi. Si vous oubliez de marquer vos rendez-vous terminés, vous n'aurez ni chiffres justes ni demandes d'avis.",
        keywords: ['termine', 'fini', 'cloturer', 'avis'],
      },
      {
        id: 'conges',
        question: 'Comment bloquer des jours de congé ?',
        answer:
          "Dans [Réglages de la page](/dashboard/admin), onglet Disponibilités, ajoutez une indisponibilité avec sa date de début et de fin. Ces journées disparaissent immédiatement des créneaux proposés : personne ne pourra réserver dessus.",
        keywords: ['conge', 'vacances', 'absence', 'indisponible', 'bloquer', 'fermer'],
      },
      {
        id: 'creneaux-groupes',
        question: 'À quoi servent les créneaux groupés ?',
        answer:
          "Quand un client réserve dans un secteur où vous avez déjà un rendez-vous, WashBoard lui propose en priorité les horaires qui vous évitent un trajet. Vous pouvez accorder une petite remise sur ces créneaux pour encourager le regroupement : vous roulez moins et vous casez plus de lavages dans la journée.",
        keywords: ['creneau', 'groupe', 'zone', 'tournee', 'trajet', 'optimisation', 'remise'],
      },
    ],
  },
  {
    id: 'clients',
    title: 'Clients et fidélisation',
    summary: 'Historique, avis Google et relances automatiques.',
    entries: [
      {
        id: 'crm',
        question: 'Où retrouver l’historique d’un client ?',
        answer:
          "Dans le [CRM](/dashboard/crm), cliquez sur la pastille ronde avec l'initiale du client, à gauche de son nom. Sa fiche s'ouvre : coordonnées, adresses utilisées, nombre de lavages, chiffre d'affaires, panier moyen et historique complet de ses rendez-vous. Si le client n'est pas revenu depuis plus de trois mois, la fiche vous le signale.",
        keywords: ['client', 'historique', 'fiche', 'contact', 'pastille', 'initiale', 'profil'],
      },
      {
        id: 'avis',
        question: 'Comment demander des avis Google automatiquement ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), carte « Avis Google ». Collez le lien vers votre fiche, choisissez le canal (email ou SMS) et le délai après le rendez-vous. La demande part ensuite toute seule dès que vous marquez un rendez-vous terminé. Le jour même fonctionne mieux : l'effet « voiture propre » est encore frais.",
        keywords: ['avis', 'google', 'etoiles', 'note', 'reputation', 'sms'],
      },
      {
        id: 'relances',
        question: 'Comment relancer mes anciens clients ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), carte « Relances clients ». Vous définissez un délai (90 jours par exemple) et un message. Tout client qui n'est pas revenu depuis ce délai reçoit automatiquement votre message. C'est le canal le plus rentable : ces gens vous connaissent déjà.",
        keywords: ['relance', 'fidelisation', 'revenir', 'inactif', 'reactivation'],
      },
    ],
  },
  {
    id: 'argent',
    title: 'Chiffre d’affaires et abonnement',
    summary: 'Suivre vos revenus et gérer votre formule.',
    entries: [
      {
        id: 'compta',
        question: 'Où voir mon chiffre d’affaires ?',
        answer:
          "Dans la [Comptabilité](/dashboard/compta) : recettes, dépenses et résultat, mois par mois. Seuls les rendez-vous marqués « terminé » sont comptés, d'où l'importance de tenir votre agenda à jour.",
        keywords: ['ca', 'chiffre', 'revenu', 'compta', 'depense', 'benefice', 'resultat'],
      },
      {
        id: 'abonnement',
        question: 'Comment gérer mon abonnement ?',
        answer:
          "Tout se passe dans [Abonnement](/dashboard/abonnement) : votre formule en cours, la prochaine échéance et les moyens de paiement. L'engagement annuel revient moins cher que le mensuel, avec deux mois offerts.",
        keywords: ['abonnement', 'payer', 'facture', 'plan', 'formule', 'annuel', 'mensuel'],
      },
      {
        id: 'compte',
        question: 'Comment changer mon mot de passe ou mon email ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), cartes « Adresse email » et « Mot de passe ». C'est également là que vous pouvez mettre votre compte en pause ou le supprimer.",
        keywords: ['mot de passe', 'email', 'compte', 'securite', 'supprimer', 'pause'],
      },
    ],
  },
]

/** Texte brut d'une entrée, liens aplatis — sert à la recherche. */
export function entryText(entry: GuideEntry): string {
  const answer = entry.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return [entry.question, answer, ...(entry.keywords ?? [])].join(' ')
}

/** Retire accents et casse, pour que « conges » trouve « congés ». */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * Filtre le guide sur une requête libre. Chaque mot saisi doit apparaître :
 * « avis sms » ne remonte que les entrées qui parlent des deux, pas de l'une
 * ou l'autre — sans quoi une recherche large ramènerait tout le guide.
 * La recherche porte aussi sur le titre de section et les mots-clés, accents
 * et casse ignorés.
 */
/** Tolere le pluriel : le contenu dit « conge », l utilisateur tape « conges ». */
function contient(haystack: string, mot: string): boolean {
  if (haystack.includes(mot)) return true
  return mot.length > 3 && mot.endsWith('s') && haystack.includes(mot.slice(0, -1))
}

export function searchGuide(query: string): GuideSection[] {
  const q = normalize(query.trim())
  if (!q) return GUIDE
  const mots = q.split(/\s+/)
  return GUIDE
    .map(section => ({
      ...section,
      entries: section.entries.filter(entry => {
        const haystack = normalize(`${section.title} ${entryText(entry)}`)
        return mots.every(mot => contient(haystack, mot))
      }),
    }))
    .filter(section => section.entries.length > 0)
}
