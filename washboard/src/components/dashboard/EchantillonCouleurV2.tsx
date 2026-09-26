import { corps } from '@/components/dashboard/FeuilleV2'

// Ce que la couleur de la marque colore sur la page de réservation, montré SANS ressembler à
// un bouton (demande d'Alexandre, 2026-09-26 : le « Continuer → » de l'aperçu faisait cliquer
// des laveurs qui ne voyaient rien se passer). Deux éléments que le client voit vraiment sur
// sa page — la barre d'avancement des étapes et le choix coché — et un libellé qui dit ce
// que c'est. Rien ici n'est interactif : ni fond plein rectangulaire, ni flèche, ni texte
// d'action.
//
// La couleur est une DONNÉE du laveur, pas un jeton de l'application. La piste (partie non
// remplie) est un gris neutre translucide, lisible sur clair, sombre et sur photo de fond.

export default function EchantillonCouleurV2({
  couleur, clair = false, libelle = 'Étape 2 sur 4',
}: {
  couleur: string
  /** Texte blanc : sur un fond choisi (dégradé ou photo), la page est toujours sombre. */
  clair?: boolean
  libelle?: string | null
}) {
  return (
    <div aria-hidden className="w-full">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2, 3].map(i => (
            <span
              key={i}
              className="h-[6px] flex-1 rounded-full"
              style={{ background: i < 2 ? couleur : 'rgba(128, 128, 128, .32)' }}
            />
          ))}
        </div>
        <span
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: couleur }}
        >
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: couleur }} />
        </span>
      </div>
      {libelle && (
        <p className={`mt-2 text-[12px] ${corps} ${clair ? 'text-white/70' : 'text-[color:var(--v2-color-gris)]'}`}>{libelle}</p>
      )}
    </div>
  )
}
