// Le logo tel qu'il apparaît en haut de la page de réservation : sur la couleur de la
// marque, entier, à la même taille que `BookingHero`. Montré au laveur au moment où il
// l'envoie (Apparence, inscription), pour qu'il juge le détourage sur le vrai fond.

export const CLASSE_LOGO_ENTETE = 'h-[60px] w-auto max-w-[180px] object-contain'

export default function ApercuLogoV2({ logoUrl, nom, couleur }: { logoUrl: string | null; nom: string; couleur: string }) {
  return (
    <div className="flex h-[92px] items-center rounded-[18px] px-5" style={{ backgroundColor: couleur }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- adresse Supabase, aperçu local
        <img src={logoUrl} alt="Votre logo" className={CLASSE_LOGO_ENTETE} />
      ) : (
        <span aria-hidden className="flex h-[60px] w-[60px] select-none items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
          {(nom || '?').split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()}
        </span>
      )}
    </div>
  )
}
