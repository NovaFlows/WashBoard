// Timeline maîtresse du Reel « Un garage te confie 3 véhicules ? » : la voix off pilote tout.
// La voix est UNE prise continue découpée par vo/decouper.py ; chaque réplique démarre à
// VO[id] (s) et mot(id, cle) donne l'instant d'un mot prononcé. Lue par render.js, par la
// capture et par audio/mix.py.
(function () {
  const VO = Object.fromEntries(Object.entries(globalThis.DEBUTS).map(([id, d]) => [id, 0.15 + d]));
  const FPS = 60;

  const norme = (s) => s.toLowerCase().replace(/[^a-zà-ÿ']/g, '');
  function mot(id, cle, n = 0) {
    const ms = globalThis.MOTS[id];
    const tous = ms.map((w, i) => [w, i]).filter(([w]) => norme(w[0]).startsWith(cle));
    if (!tous[n]) throw new Error(`mot « ${cle} » (${n}) absent de la réplique ${id}`);
    return VO[id] + tous[n][0][1];
  }
  function finVO(id) { return VO[id] + globalThis.DUREES[id]; }

  const K = {
    garage: mot('01', 'garage'),
    vehicules: mot('01', 'véhicules'),
    page: mot('02', 'page'),
    washboard: mot('02', 'washboard'),
    ajoute: mot('02', 'ajoute'),
    reservation: mot('02', 'réservation'),
    un: mot('02', 'un'),
    deux: mot('02', 'deux'),
    trois: mot('02', 'trois'),
    prix: mot('02', 'prix'),
    seul: mot('02', 'seul'),
    coche: mot('03', 'coche'),
    je: mot('03', 'je'),
    entreprise: mot('03', 'entreprise'),
    met: mot('03', 'met'),
    nom: mot('03', 'nom'),
    siret: mot('03', 'siret'),
    toi: VO['04'],
    recois: mot('04', 'reçois'),
    demande: mot('04', 'demande'),
    confirmes: mot('04', 'confirmes'),
    quand: VO['05'],
    termine: mot('05', 'terminé'),
    facture: mot('05', 'facture'),
    mail: mot('05', 'mail'),
    sonNom: mot('05', 'nom'),
    envoie: VO['06'],
    pote: mot('06', 'pote'),
    essaie: VO['07'],
    bio: mot('07', 'bio'),
    fin: finVO('07'),
  };
  const DUREE = K.fin + 2.3;

  // ── le téléphone du garage : la vraie page de réservation dans Safari
  K.entreeClient = VO['02'] - 0.15;
  K.tapUtilitaire = K.ajoute;
  K.r2 = K.tapUtilitaire + 0.15;            // la page défile jusqu'au compteur, Utilitaire choisi
  K.tapPlus1 = K.deux - 0.08;
  K.tapPlus2 = K.trois - 0.08;
  K.tapExterieur = K.prix + 0.2;
  K.r5 = K.tapExterieur + 0.12;              // Extérieur choisi : total 105 € en bas
  K.r7 = VO['03'] - 0.05;                    // ses coordonnées (étape 3)
  K.tapCase = K.je - 0.05;
  K.r8 = K.tapCase + 0.1;
  K.r9 = K.met - 0.1;                        // nom de l'entreprise + SIRET remplis
  K.tapConfirmer = VO['04'] - 0.2;
  K.r10 = K.tapConfirmer + 0.15;             // « Réservation envoyée ! »
  K.sortieClient = K.toi + 0.45;           // on laisse lire « Réservation envoyée ! »

  // ── ton téléphone : la notification, la demande, la facture
  K.entreeLaveur = K.sortieClient + 0.2;
  K.notif = Math.max(K.recois, K.entreeLaveur + 0.35);
  K.deverrouille = Math.max(K.demande + 0.1, K.notif + 0.45);
  K.tapCarte = Math.max(K.confirmes + 0.1, K.deverrouille + 0.7);
  K.d2 = K.termine + 0.1;                    // « Devis et factures » : la facture du garage en tête
  K.carteMail = K.mail - 0.3;                // le mail reçu par le garage
  K.sortieLaveur = K.envoie - 0.05;

  // Bruitages : [instant, nom, gain]. Rares, la voix reste devant.
  const CUES = [
    [0.1, 'snap', 0.45],
    [K.vehicules, 'pin', 0.3],
    [K.entreeClient, 'whoosh', 0.3],
    [K.tapUtilitaire, 'tap', 0.5],
    [K.r2, 'whoosh', 0.15],
    [K.tapPlus1, 'tap', 0.5],
    [K.tapPlus2, 'tap', 0.5],
    [K.tapExterieur, 'tap', 0.5],
    [K.seul, 'pin', 0.35],
    [K.r7, 'whoosh', 0.15],
    [K.tapCase, 'tap', 0.5],
    ...Array.from({ length: 10 }, (_, i) => [K.r9 - 0.45 + i * 0.045, 'tick', 0.1]),
    [K.tapConfirmer, 'tap', 0.55],
    [K.r10, 'select', 0.5],
    [K.sortieClient, 'whoosh', 0.3],
    [K.entreeLaveur, 'whoosh', 0.25],
    [K.notif, 'blip', 0.45],
    [K.tapCarte, 'tap', 0.5],
    [K.d2, 'whoosh', 0.2],
    [K.facture, 'select', 0.45],
    [K.carteMail, 'blip', 0.4],
    [K.sortieLaveur, 'whoosh', 0.3],
    [K.fin + 0.2, 'impact', 0.5],
  ];

  globalThis.TL = { VO, DUREE, FPS, K, CUES, mot, finVO };
  if (typeof module !== 'undefined') module.exports = globalThis.TL;
})();
