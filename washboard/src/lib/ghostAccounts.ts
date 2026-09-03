// Sélection des « comptes fantômes » : des utilisateurs d'authentification
// sans fiche laveur.
//
// Un tel compte ne sert à rien mais bloque son adresse email à vie — la
// personne ne peut plus se réinscrire, et rien ne le signale. L'inscription
// tente déjà d'annuler la création quand l'insertion de la fiche échoue, mais
// cette annulation peut échouer à son tour ; il faut donc un rattrapage.
//
// Le calcul est isolé ici parce qu'il décide de SUPPRESSIONS DÉFINITIVES :
// une erreur de raisonnement effacerait des comptes légitimes. En fonction
// pure, il se vérifie sans base de données.

export type CompteAuth = { id: string; created_at: string }

/** Utilisateurs à supprimer : sans fiche laveur, et assez anciens.
 *
 *  Le délai est indispensable : une inscription crée l'utilisateur *puis* sa
 *  fiche. Entre les deux, le compte ressemble exactement à un fantôme. Sans
 *  attendre, on supprimerait le compte d'un laveur en train de s'inscrire. */
export function selectionnerFantomes(
  utilisateurs: CompteAuth[],
  idsAvecFiche: Iterable<string>,
  maintenant: Date,
  ageMinHeures = 24,
): string[] {
  const rattaches = new Set(idsAvecFiche)
  const limite = maintenant.getTime() - ageMinHeures * 60 * 60 * 1000

  return utilisateurs
    .filter(u => {
      if (rattaches.has(u.id)) return false
      const cree = new Date(u.created_at).getTime()
      // Une date illisible ne doit jamais valoir « très ancien » : dans le
      // doute on garde le compte, quitte à ce qu'un fantôme survive.
      if (!Number.isFinite(cree)) return false
      return cree <= limite
    })
    .map(u => u.id)
}
