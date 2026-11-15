'use client'

import { useT } from '@/components/i18n/I18nProvider'

// Aperçus décoratifs affichés derrière un écran « changer d'offre ».
//
// Un écran verrouillé qui ne montre qu'un cadenas ne donne envie de rien : le
// laveur ne sait pas ce qu'il rate. Ici il lit les INTITULÉS — « Chiffre
// d'affaires », « D'où viennent vos clients », « Instagram » — et ne voit pas
// les VALEURS, floutées. Il comprend donc exactement ce que l'outil calcule,
// sans qu'on lui montre des chiffres qui ne sont pas les siens.
//
// C'est la seule partie qui est floutée, et c'est un choix de lecture, pas une
// protection : un flou CSS se retire en deux clics dans les outils du
// navigateur. La vraie garantie est ailleurs — TOUT CE QUI EST ICI EST
// INVENTÉ, et les pages concernées ne chargent aucune donnée réelle, le verrou
// étant posé avant les lectures en base.
//
// Le mot « Exemple » reste net dans chaque aperçu : personne ne doit prendre
// ces chiffres pour son activité.

const CARTE = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5'

/** Une valeur qu'on devine sans la lire. Les intitulés, eux, restent nets. */
function Flou({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`blur-[5px] select-none ${className}`}>{children}</span>
}

function Etiquette() {
  const t = useT()
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
      {t('Exemple')}
    </span>
  )
}

function Chiffre({ label, valeur, couleur = 'text-slate-900 dark:text-slate-100' }: {
  label: string; valeur: string; couleur?: string
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${couleur}`}><Flou>{valeur}</Flou></p>
    </div>
  )
}

export function ApercuCompta() {
  const t = useT()
  const mois = [55, 70, 48, 82, 64, 91]
  return (
    <div className="space-y-4" aria-hidden>
      <div className={CARTE}>
        <Etiquette />
        <div className="flex gap-4">
          <Chiffre label={t('Chiffre d’affaires')} valeur="4 280 €" />
          <Chiffre label={t('Dépenses')} valeur="960 €" couleur="text-orange-600 dark:text-orange-400" />
          <Chiffre label={t('Résultat')} valeur="3 320 €" couleur="text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>
      <div className={CARTE}>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">{t('Mois par mois')}</p>
        <div className="flex items-end gap-3 h-28 blur-[4px]">
          {mois.map((h, i) => (
            <span key={i} className="flex-1 rounded-t-lg bg-blue-500/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ApercuCrm() {
  const t = useT()
  const sources = [
    { nom: 'Instagram', pct: 82 },
    { nom: 'Google', pct: 54 },
    { nom: 'TikTok', pct: 38 },
    { nom: t('Bouche-à-oreille'), pct: 21 },
  ]
  return (
    <div className="space-y-4" aria-hidden>
      <div className={CARTE}>
        <Etiquette />
        <div className="flex gap-4">
          <Chiffre label={t('Visiteurs')} valeur="612" />
          <Chiffre label={t('Réservations')} valeur="48" />
          <Chiffre label={t('Transformation')} valeur="7,8 %" couleur="text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>
      <div className={CARTE}>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">{t('D’où viennent vos clients')}</p>
        <div className="space-y-3">
          {sources.map(s => (
            <div key={s.nom}>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                {/* Le nom de la source est net, sa part est floutée : le laveur
                    apprend qu'on lui dira d'où viennent ses clients, pas
                    combien viennent d'où — ça, c'est ce qu'il achète. */}
                <span>{s.nom}</span>
                <Flou className="font-semibold">{s.pct} %</Flou>
              </div>
              <span className="block h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden blur-[3px]">
                <span className="block h-full rounded-full bg-blue-500" style={{ width: `${s.pct}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ApercuFactures() {
  const t = useT()
  const lignes = [
    ['2026-014', t('Garage Mérignac'), '480 €'],
    ['2026-013', t('Résidence du Parc'), '260 €'],
    ['2026-012', t('Auto-école Conduite+'), '180 €'],
    ['2026-011', 'Thomas R.', '75 €'],
    ['2026-010', 'Claire M.', '45 €'],
  ]
  return (
    <div className="space-y-4" aria-hidden>
      <div className={CARTE}>
        <Etiquette />
        <div className="flex gap-4">
          <Chiffre label={t('Facturé cette année')} valeur="12 640 €" />
          <Chiffre label={t('Factures émises')} valeur="34" />
        </div>
      </div>
      <div className={`${CARTE} p-0 overflow-hidden`}>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 px-5 pt-5 pb-3">{t('Vos factures émises')}</p>
        {lignes.map(([num, client, montant], i) => (
          <div
            key={num}
            className={`flex items-center gap-4 px-5 py-3.5 text-sm ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
          >
            <Flou className="font-mono text-xs text-slate-400">{num}</Flou>
            <Flou className="flex-1 text-slate-700 dark:text-slate-300 truncate">{client}</Flou>
            <Flou className="font-bold text-slate-900 dark:text-slate-100">{montant}</Flou>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Aperçu de l'écran des campagnes, pour l'invitation à passer au Pro.
 *
 *  Décoratif, comme les autres : les chiffres sont inventés, aucun n'est lu en
 *  base. Ce qui reste NET, c'est ce que le laveur comprendra qu'on lui dira —
 *  « Retour », « Coût par client » ; ce qui est flouté, c'est la réponse. */
export function ApercuCampagnes() {
  const t = useT()
  return (
    <div className="space-y-4" aria-hidden>
      <div className={CARTE}>
        <Etiquette />
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{t('Pub Rentrée')}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('Meta · budget 80 €')}</p>
        <div className="flex gap-4">
          <Chiffre label={t('Visites')} valeur="312" />
          <Chiffre label={t('Réservations')} valeur="14" />
          <Chiffre label={t('Retour')} valeur="× 11,4" couleur="text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>
      <div className={CARTE}>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">{t('Ce qu’elle vous a rapporté')}</p>
        <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span>{t('Coût par client')}</span>
            <Flou className="font-semibold">5,71 €</Flou>
          </div>
          <div className="flex justify-between">
            <span>{t('Chiffre d’affaires')}</span>
            <Flou className="font-semibold">910 €</Flou>
          </div>
        </div>
      </div>
    </div>
  )
}
