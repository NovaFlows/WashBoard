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
          "Trois points bloquent la mise en ligne tant qu'ils ne sont pas faits, et la carte « Démarrage » de votre [tableau de bord](/dashboard) suit votre avancement. D'abord vos prestations et vos tarifs dans [Réglages de la page](/dashboard/admin), onglet Prestations — une prestation se range toujours dans une catégorie, donc créez la catégorie d'abord, sinon vous ne pourrez rien enregistrer. Ensuite vos horaires de travail, onglet Disponibilités. Enfin votre adresse de départ dans [Paramètres](/dashboard/parametres), carte « Mon profil » : elle sert à calculer vos trajets et votre zone, et sans elle un client trop éloigné peut réserver un créneau que vous ne pourrez pas honorer. Votre téléphone et votre logo comptent aussi, mais ils ne bloquent pas la page.",
        keywords: ['debuter', 'commencer', 'configuration', 'installation', 'demarrage', 'etape'],
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
          "Dans [Réglages de la page](/dashboard/admin), onglet Prestations. Commencez par créer une catégorie — ce que vous traitez : Voiture, Canapé, Piscine, ce que vous voulez. Une prestation appartient toujours à une catégorie, donc sans catégorie vous ne pourrez pas l'enregistrer. Chaque catégorie a ensuite ses types, et c'est là que se joue le tarif : pour Voiture ce sera citadine, berline, SUV ; pour Canapé, le nombre de places. Vous pouvez donner un prix différent à chaque type, puisqu'ils ne demandent pas le même temps. Enfin la prestation elle-même a un nom, une durée et un prix. Les options supplémentaires se paramètrent au même endroit.",
        keywords: ['prix', 'tarif', 'service', 'prestation', 'duree', 'option', 'categorie', 'type'],
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
          "Cela se règle à deux endroits. Votre adresse de départ et vos frais de déplacement sont dans [Paramètres](/dashboard/parametres), carte « Mon profil ». Le rayon que vous acceptez est dans [Réglages de la page](/dashboard/admin), onglet Identité, section Zone d'intervention — vous pouvez le définir à vol d'oiseau, par la route, ou par départements. Une adresse hors zone est refusée automatiquement, avant même que le client ne choisisse un créneau.",
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
          "Une nouvelle réservation arrive en « en attente ». Confirmez-la depuis votre [tableau de bord](/dashboard), où elle apparaît dès votre connexion, ou en l'ouvrant dans le [Calendrier](/dashboard/calendrier). Votre client reçoit alors un email de confirmation, et c'est à ce moment que le rendez-vous est ajouté à votre Google Agenda, si vous l'avez connecté.",
        keywords: ['confirmer', 'valider', 'en attente', 'accepter', 'agenda google'],
      },
      {
        id: 'terminer',
        question: 'Que se passe-t-il quand je marque un RDV « terminé » ?',
        answer:
          "C'est l'action qui déclenche tout le suivi. Le chiffre d'affaires est comptabilisé dans la [Comptabilité](/dashboard/compta), la demande d'avis Google part automatiquement après le délai que vous avez choisi, et votre facture est créée — envoyée par email si le client a réservé en tant que professionnel. Si vous oubliez de marquer vos rendez-vous terminés, vous n'aurez ni chiffres justes, ni demandes d'avis, ni factures.",
        keywords: ['termine', 'fini', 'avis', 'facture'],
      },
      {
        id: 'cloturer',
        question: 'J’ai oublié de marquer un rendez-vous, que faire ?',
        answer:
          "Dès qu'un rendez-vous dont l'heure est passée n'a jamais été terminé, WashBoard vous demande s'il a réellement eu lieu avant de le clôturer — que vous passiez par le bouton « Clôturer » de votre [tableau de bord](/dashboard) ou par « Marquer terminé » dans le [Calendrier](/dashboard/calendrier). Si vous répondez oui, il passe en terminé et la facture suit normalement ; si vous répondez non, il est annulé, sans facture, sans effet sur votre comptabilité, et votre client ne reçoit aucun message. Cette question n'apparaît que pour un créneau déjà passé : un rendez-vous que vous terminez en avance se clôture d'un seul clic. Un rendez-vous clôturé tardivement porte ensuite l'étiquette orange « Délai dépassé » plutôt que « Terminé » : c'est normal, cela indique seulement que la clôture a été faite après coup. Il est bien compté et bien facturé.",
        keywords: ['cloturer', 'oubli', 'oublie', 'retard', 'passe', 'delai depasse', 'rattraper'],
      },
      {
        id: 'rappel-soir',
        question: 'À quoi sert la notification de 22 h ?',
        answer:
          "Chaque soir à 22 h, si des rendez-vous du jour ne sont toujours pas marqués « Terminé », WashBoard vous envoie une notification sur votre téléphone pour vous éviter de les oublier — donc d'oublier les factures qui vont avec. Attention : ce rappel passe uniquement par les notifications de l'application, il n'existe ni en email ni en SMS. Si vous ne les avez jamais activées, vous ne le recevrez pas ; la carte Notifications de vos [Paramètres](/dashboard/parametres) vous le rappelle tant qu'elles sont inactives. Voir la section Application mobile pour les activer. Vos réservations, elles, continuent de vous arriver par email quoi qu'il arrive.",
        keywords: ['rappel', 'notification', '22h', 'soir', 'oubli', 'relance'],
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
          "Quand un client réserve dans un secteur où vous avez déjà un rendez-vous, WashBoard lui propose en priorité les horaires qui vous évitent un trajet. Vous pouvez accorder une petite remise sur ces créneaux pour encourager le regroupement : vous roulez moins et vous casez plus de rendez-vous dans la journée.",
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
          "Le plus simple est l'onglet [Clients](/dashboard/clients) : c'est votre fichier complet, avec une recherche par nom, téléphone, email ou même adresse déjà utilisée. Tapez les premiers chiffres d'un numéro et vous retrouvez la personne en une seconde — pratique quand un client vous appelle. Cliquez sur sa ligne pour ouvrir sa fiche : coordonnées, adresses, nombre de prestations, chiffre d'affaires, panier moyen et historique complet. Si le client n'est pas revenu depuis plus de trois mois, la fiche vous le signale.",
        keywords: ['client', 'historique', 'fiche', 'contact', 'profil', 'rechercher', 'annuaire', 'telephone'],
      },
      {
        id: 'clients-vs-crm',
        question: 'Quelle différence entre l’onglet Clients et le CRM ?',
        answer:
          "Ils ne servent pas à la même chose. L'onglet [Clients](/dashboard/clients) est votre annuaire : tous vos clients, sans limite de date, avec une vraie recherche. C'est là qu'il faut aller pour retrouver quelqu'un. Le [CRM](/dashboard/crm) est un tableau de bord de statistiques sur une période que vous choisissez — d'où viennent vos visiteurs, combien se transforment en réservation, quels appareils ils utilisent. Il n'affiche que les dernières réservations de la période et n'a pas de recherche, donc un client ancien y est souvent introuvable. Les deux ouvrent la même fiche client.",
        keywords: ['crm', 'clients', 'difference', 'statistiques', 'annuaire', 'entonnoir'],
      },
      {
        id: 'avis',
        question: 'Comment demander des avis Google automatiquement ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), carte « Avis Google ». Collez le lien vers votre fiche, choisissez le canal (email ou SMS) et le délai après le rendez-vous. La demande part ensuite toute seule dès que vous marquez un rendez-vous terminé. Le jour même fonctionne mieux : l'effet « tout propre » est encore frais.",
        keywords: ['avis', 'google', 'etoiles', 'note', 'reputation', 'sms'],
      },
      {
        id: 'relances',
        question: 'Comment relancer mes anciens clients ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), carte « Relances clients », disponible avec la formule Pro. Vous activez l'interrupteur, choisissez un délai — 90 jours par exemple — et écrivez votre message une seule fois. Écrivez {{nom}} dedans et le prénom du client s'y met automatiquement. Ensuite tout se fait seul : chaque client qui n'est pas revenu depuis ce délai reçoit votre message, par email ou par SMS selon le canal choisi dans la carte « Avis Google », et toujours à votre nom. Deux sécurités : un client qui a déjà repris rendez-vous ne reçoit rien, et personne n'est relancé deux fois. Pensez à mettre votre lien de réservation dans le message, sinon le client n'a nulle part où cliquer.",
        keywords: ['relance', 'fidelisation', 'revenir', 'inactif', 'reactivation', 'pro', 'sms'],
      },
    ],
  },
  {
    id: 'factures',
    title: 'Factures',
    summary: 'Facturer vos clients et récupérer vos anciennes factures.',
    entries: [
      {
        id: 'facturation-infos',
        question: 'Que dois-je remplir pour pouvoir facturer ?',
        answer:
          "Dans [Paramètres](/dashboard/parametres), carte « Facturation ». Indiquez d'abord votre statut : micro-entreprise ou entreprise individuelle d'un côté, société de l'autre. Il faut ensuite votre nom légal ou votre raison sociale, votre SIRET, votre adresse professionnelle, et votre régime de TVA. Une société ajoute sa forme juridique, son capital et son immatriculation RCS ; si vous facturez la TVA, votre numéro de TVA intracommunautaire est également demandé. Tant qu'il manque quelque chose, l'onglet [Factures](/dashboard/factures) affiche un bandeau qui vous dit précisément quoi.",
        keywords: ['facture', 'facturation', 'siret', 'tva', 'statut', 'societe', 'micro', 'auto entrepreneur'],
      },
      {
        id: 'facture-quand',
        question: 'Quand mes factures sont-elles créées ?',
        answer:
          "Automatiquement, au moment où vous marquez un rendez-vous « Terminé ». Vous n'avez rien à faire de plus. Si vos informations de facturation sont incomplètes, le rendez-vous passe quand même en terminé mais aucune facture n'est créée : le client reçoit un simple récapitulatif. Une fois les informations complétées, vous pourrez émettre la facture manquante depuis la fiche du rendez-vous, avec le bouton « Émettre la facture ». Toutes vos factures se retrouvent dans l'onglet [Factures](/dashboard/factures).",
        keywords: ['facture', 'quand', 'automatique', 'emettre', 'termine', 'recapitulatif'],
      },
      {
        id: 'facture-qui-recoit',
        question: 'Mon client reçoit-il sa facture par email ?',
        answer:
          "Uniquement s'il a réservé en tant que professionnel. C'est le client qui choisit « Particulier » ou « Professionnel » au début de la réservation — vous n'avez rien à cocher. S'il choisit professionnel, il doit donner sa raison sociale et son SIRET, et sa facture lui est envoyée par email dès que vous marquez le rendez-vous terminé. Un particulier ne reçoit pas d'envoi séparé : sa facture existe bien, vous la retrouvez dans votre onglet Factures, et lui y accède depuis son lien de confirmation.",
        keywords: ['facture', 'email', 'client', 'professionnel', 'particulier', 'envoi', 'pro'],
      },
      {
        id: 'facture-numero',
        question: 'Comment fonctionne la numérotation des factures ?',
        answer:
          "WashBoard s'en charge : vos factures sont numérotées à la suite, au format F-00001, et le numéro est attribué au moment de l'émission. Si vous facturiez déjà avant d'arriver, vous pouvez reprendre votre propre numérotation : dans [Paramètres](/dashboard/parametres), carte « Facturation », renseignez le numéro de la prochaine facture. Attention, ce numéro ne peut jamais reculer — c'est une obligation comptable, et WashBoard refusera une valeur inférieure à une facture déjà émise. Réglez-le donc avant votre première facture.",
        keywords: ['numero', 'numerotation', 'suite', 'continu', 'depart', 'reprendre'],
      },
      {
        id: 'factures-import',
        question: 'Puis-je récupérer mes anciennes factures ?',
        answer:
          "Oui, dans l'onglet [Factures](/dashboard/factures). Vous pouvez les déposer une par une, en PDF, JPG ou PNG, ou tout envoyer d'un coup dans un fichier ZIP — jusqu'à 200 factures. WashBoard tente de lire la date de chaque facture, mais vérifiez-la : une facture sans date ne peut pas être enregistrée. Le montant et le numéro d'origine sont facultatifs, et une facture importée garde son numéro d'origine, elle ne prend pas de numéro WashBoard. Un point important : cet import est réservé à vos factures de vente, celles que vous avez émises. Les factures d'achat auront leur propre espace, encore en développement.",
        keywords: ['import', 'importer', 'anciennes', 'zip', 'reprise', 'pdf', 'achat', 'vente'],
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
          "Tout se passe dans [Abonnement](/dashboard/abonnement) : votre formule en cours, la prochaine échéance et les moyens de paiement. L'engagement annuel revient moins cher que le mensuel : le détail des offres et l'économie réalisée s'affichent sur la page.",
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
  {
    id: 'application',
    title: 'Application mobile (bêta)',
    summary: 'Recevoir ses réservations en notification sur son téléphone.',
    entries: [
      {
        id: 'app-pourquoi',
        question: 'À quoi sert l\'application ?',
        answer:
          "Elle vous prévient sur votre téléphone dès qu'un client réserve, sans que vous ayez à ouvrir vos emails. La notification affiche le nom du client, la prestation avec le montant que vous allez encaisser — options, véhicules et frais de déplacement compris — et l'horaire ; en la touchant, vous arrivez directement sur le rendez-vous. Sur Android, deux boutons permettent même de confirmer ou refuser sans ouvrir l'application. L'email continue de partir en parallèle : la notification s'ajoute, elle ne remplace rien.",
        keywords: ['application', 'appli', 'mobile', 'notification', 'alerte', 'telephone', 'beta'],
      },
      {
        id: 'app-installer',
        question: 'Comment installer l\'application ?',
        answer:
          "Il n'y a rien à télécharger : WashBoard s'ajoute directement à l'écran d'accueil depuis votre navigateur. Sur iPhone, ouvrez washboard.fr dans Safari (et pas dans Chrome ni dans un navigateur intégré à Instagram), touchez le bouton Partager en bas de l'écran, puis « Sur l'écran d'accueil ». Sur Android, ouvrez washboard.fr dans Chrome, touchez le menu ⋮ en haut à droite, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ». L'icône WashBoard apparaît ensuite parmi vos applications, et elle s'ouvre en plein écran, sans barre de navigateur.",
        keywords: ['installer', 'installation', 'ecran accueil', 'telecharger', 'iphone', 'android', 'safari', 'chrome', 'pwa'],
      },
      {
        id: 'app-notifications',
        question: 'Comment activer les notifications ?',
        answer:
          "Une fois l'application ajoutée à l'écran d'accueil, ouvrez-la depuis son icône — pas depuis le navigateur — puis allez dans [Paramètres](/dashboard/parametres) et activez les notifications. Votre téléphone demandera l'autorisation : acceptez-la. Un essai vous confirme que tout fonctionne. Sur iPhone, l'ordre compte : Apple interdit les notifications tant que l'application n'a pas été ajoutée à l'écran d'accueil, donc installez d'abord, activez ensuite.",
        keywords: ['notification', 'activer', 'autorisation', 'permission', 'alerte', 'push'],
      },
      {
        id: 'app-rien-recu',
        question: 'Je ne reçois aucune notification',
        answer:
          "Quatre causes, de la plus fréquente à la plus rare. D'abord, sur iPhone, l'application doit avoir été ouverte depuis son icône sur l'écran d'accueil : depuis Safari, Apple bloque les notifications. Ensuite, l'autorisation a peut-être été refusée au moment de la demande — dans ce cas le bouton ne suffit plus, il faut la réactiver dans les réglages du téléphone, à la ligne WashBoard. Vérifiez aussi que le mode concentration ou « Ne pas déranger » n'est pas actif. Enfin, si vous avez changé de téléphone ou désinstallé l'application, l'abonnement est perdu : réinstallez et réactivez. En cas de doute, l'email de réservation, lui, part toujours.",
        keywords: ['pas de notification', 'rien recu', 'ne marche pas', 'probleme', 'bloque', 'refuse', 'iphone'],
      },
      {
        id: 'app-beta',
        question: 'Pourquoi « bêta » ?',
        answer:
          "L'application fonctionne, mais elle est récente et nous la surveillons de près. Deux limites connues : sur iPhone, les boutons « Confirmer » et « Refuser » n'apparaissent pas dans la notification — Apple ne les gère pas — la notification reste simplement cliquable. Et une notification peut arriver avec quelques minutes de retard si votre téléphone est en veille prolongée. Si quelque chose vous semble anormal, écrivez-nous : c'est exactement ce qu'on cherche à savoir pendant cette phase.",
        keywords: ['beta', 'test', 'limite', 'bug', 'ios', 'iphone', 'retard'],
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

/** Pertinence : où le mot cherché a-t-il été trouvé ?
 *
 *  Une question qui porte sur le mot vaut mieux qu'une réponse qui le mentionne
 *  en passant. Sans ce classement, chercher « factures » remontait d'abord les
 *  entrées de l'agenda — elles parlent de facture sans être sur le sujet — et
 *  la section Factures arrivait après, parce que l'ordre était celui de
 *  déclaration des sections et rien d'autre. */
const POIDS = { question: 8, motsCles: 4, titreSection: 2, reponse: 1 }

function scoreEntree(entry: GuideEntry, titreSection: string, mots: string[]): number {
  const question = normalize(entry.question)
  const motsCles = normalize((entry.keywords ?? []).join(' '))
  const titre = normalize(titreSection)
  const reponse = normalize(entry.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
  let score = 0
  for (const mot of mots) {
    if (contient(question, mot)) score += POIDS.question
    if (contient(motsCles, mot)) score += POIDS.motsCles
    if (contient(titre, mot)) score += POIDS.titreSection
    if (contient(reponse, mot)) score += POIDS.reponse
  }
  return score
}

export function searchGuide(query: string): GuideSection[] {
  const q = normalize(query.trim())
  if (!q) return GUIDE
  const mots = q.split(/\s+/)
  return GUIDE
    .map(section => {
      // Filtrage inchangé : ce qui remonte ne change pas, seul l'ordre change.
      const retenues = section.entries
        .filter(entry => {
          const haystack = normalize(`${section.title} ${entryText(entry)}`)
          return mots.every(mot => contient(haystack, mot))
        })
        .map(entry => ({ entry, score: scoreEntree(entry, section.title, mots) }))
        // Le tri est stable : à score égal, l'ordre de rédaction est conservé.
        .sort((a, b) => b.score - a.score)
      return {
        section: { ...section, entries: retenues.map(r => r.entry) },
        // Une section vaut ce que vaut sa meilleure réponse.
        score: retenues[0]?.score ?? 0,
      }
    })
    .filter(s => s.section.entries.length > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.section)
}
