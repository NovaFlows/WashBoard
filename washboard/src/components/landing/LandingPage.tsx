'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from '@/components/ui/ThemeProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  PLAN_CARDS, freeMonthsLabel, formatEuros, yearlyPrice, yearlyMonthlyEquivalent,
  lienRendezVousBusiness, rendezVousExterne, LIBELLE_CONTACT, LIBELLE_RDV_BUSINESS, RDV_BUSINESS_MINUTES,
  PLAN_COULEURS, SMS_QUOTA, requiredPlan, requiredPlanLabel,
  type BillingCycle, type Feature,
} from '@/lib/plan'
import BillingToggle from '@/components/ui/BillingToggle'
import { SOCIAL_LINKS } from '@/components/ui/socialLinks'
import { FAQ_ITEMS } from '@/lib/faq'
import { metierPageForTheme } from '@/lib/metiers'
import type { Theme } from '@/lib/blog'
import { ComparatifBesoins } from '@/components/ComparatifBesoins'
import { besoinsHead, besoinsRows } from '@/lib/comparatifAuto'

// Slogans courts et uniformes — pas de saut de layout
//
// Le premier est celui rendu au premier chargement (`useState(0)` plus bas) :
// c'est LUI que Google et les IA lisent comme <h1>, le rendu HTML n'attend
// pas la rotation JS. Ajouté le 2026-09-28 pour cette raison précise : le
// H1 ne portait auparavant aucun mot-clé ("Fais plus. Gère moins."), quand
// le title, lui, en avait — un décalage qui affaiblit le signal envoyé aux
// moteurs. Garder ce premier slogan porteur de mots-clés (nettoyage,
// detailing, auto, à domicile) si l'ordre change à nouveau.
//
// « Court » n'est pas cosmétique : une première version à 59 caractères
// ("L'indispensable du nettoyage et detailing auto à domicile.") passait sur
// 4 lignes en desktop et chevauchait le paragraphe du dessous — le conteneur
// a une hauteur FIXE (h-[4em] / h-[3em] plus bas), calibrée sur les trois
// slogans d'origine (23 à 48 caractères). Rester sous ~48 caractères, la
// longueur du plus long des trois, garde le rendu dans les clous.
const SLOGANS: { pre: string; hl: string; post: string }[] = [
  { pre: 'Nettoyage, detailing auto. ', hl: 'À domicile.', post: '' },
  { pre: 'Fais plus. ', hl: 'Gère moins.', post: '' },
  { pre: 'Tes clients réservent seuls. ', hl: 'Toi tu encaisses.', post: '' },
  { pre: 'Réservation, planning, factures. ', hl: 'Un seul outil.', post: '' },
]

// Icônes des réseaux sociaux du pied de page : voir
// `@/components/ui/socialLinks` (SOCIAL_LINKS), aussi utilisé par le menu du
// tableau de bord — une seule définition pour les deux endroits.

function RotatingHeadline() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI(p => (p + 1) % SLOGANS.length), 4500)
    return () => clearInterval(id)
  }, [])
  const s = SLOGANS[i]
  return (
    <span className="block relative h-[4em] sm:h-[3em]">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-x-0 top-0"
        >
          {s.pre}
          <span className="hero-hl">{s.hl}</span>
          {s.post}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function FadeUp({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }} viewport={{ once: true, margin: '-60px' }}>
      {children}
    </motion.div>
  )
}

function FadeGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}>
      {children}
    </motion.div>
  )
}

function FadeItem({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div className={className} style={style} variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }}>
      {children}
    </motion.div>
  )
}

// Une entrée de la grille « Et tout le reste, dans le même outil. ».
function FonctionnaliteItem({ f }: { f: Fonctionnalite }) {
  // Badge = offre minimale lue dans MIN_PLAN, jamais écrite à la main : un
  // booléen « pro » avait laissé « Multi-laveurs » marqué Pro après son
  // passage en Business. Rien d'affiché pour ce que l'offre gratuite ouvre.
  const badge = f.offre && requiredPlan(f.offre) !== 'decouverte' ? requiredPlanLabel(f.offre) : null
  return (
    <FadeItem>
      <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
        {f.titre}
        {badge && (
          <span className="text-[10px] font-black uppercase tracking-wider text-[#1651E8] dark:text-[#6A9FFF] border border-[#1651E8]/30 dark:border-[#6A9FFF]/30 rounded-md px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
    </FadeItem>
  )
}

// Tout ce que fait le produit, sous la fonctionnalité phare. `offre` pointe la
// clé de MIN_PLAN (lib/plan.ts) : le badge en est dérivé, pour ne jamais
// annoncer dans une offre ce qui appartient à l'offre du dessus. La grille 2026 en compte quatre — Découverte, Starter,
// Pro, Business — et c'est `plan.ts` qui en est la seule source.
// Ordre demandé par Ryan le 2026-09-27 : la facturation remonte près du haut
// de la grille (déjà mise en avant dans l'encart phare juste au-dessus, elle
// mérite aussi sa place ici) ; les créneaux intelligents, eux, redescendent
// après les statistiques puisqu'ils ont désormais leur propre section dédiée
// plus bas sur la page ; déplacement et appli/notifications sont intervertis.
type Fonctionnalite = { titre: string; desc: string; offre?: Feature }
const FONCTIONNALITES: Fonctionnalite[] = [
  { titre: 'Page de réservation à ton image', desc: `Tes prestations et tes prix, réservables sans créer de compte. Ton logo et tes couleurs dès la formule ${requiredPlanLabel('page_personnalisee')}.` },
  { titre: 'Agenda', desc: 'Vues mois, semaine et jour. Tu ajoutes un rendez-vous à la main et tu bloques tes congés.' },
  { titre: 'Facturation', desc: 'Facture conforme (SIRET, TVA, numérotation continue), envoyée automatiquement à tes clients pros dès qu’une prestation est terminée. Détail juste au-dessus.', offre: 'facturation' },
  { titre: 'Appli et notifications', desc: 'WashBoard s’installe sur ton téléphone et t’envoie chaque nouvelle réservation. En bêta.' },
  { titre: 'Google Agenda', desc: 'Tes réservations s’ajoutent à ton Google Agenda et suivent chaque modification.' },
  { titre: 'Frais de déplacement', desc: 'Calculés selon la distance, depuis ton point de départ ou ton rendez-vous précédent.', offre: 'frais_deplacement' },
  { titre: 'CRM et statistiques', desc: 'Visiteurs, taux de conversion, sources (Instagram, TikTok, Google…) et export Excel.', offre: 'crm' },
  { titre: 'Campagnes publicitaires', desc: 'Combien de réservations viennent de chaque campagne Meta, et ce qu’elle te rapporte.', offre: 'campagnes' },
  { titre: 'Créneaux intelligents', desc: 'Les horaires proches d’un rendez-vous déjà prévu mis en avant au client, avec une remise si tu en as réglé une.', offre: 'creneaux_intelligents' },
  { titre: 'Fiche client', desc: 'Historique, chiffre d’affaires, panier moyen, et une alerte quand un client n’est pas revenu depuis 90 jours.' },
  { titre: 'Avis Google automatiques', desc: `Une demande d’avis après chaque prestation terminée, par email ou par SMS (${SMS_QUOTA.pro} par mois).`, offre: 'avis_email' },
  { titre: 'Relances de suivi', desc: 'Un message automatique pour faire revenir un client après sa dernière prestation.', offre: 'followup' },
  { titre: 'Comptabilité', desc: 'Chiffre d’affaires, dépenses, dépenses récurrentes et résultat, par jour, semaine, mois ou année.', offre: 'compta' },
  { titre: 'Multi-laveurs', desc: 'Plusieurs rendez-vous en même temps, selon la taille de ton équipe.', offre: 'multi_laveurs' },
]

// Les trois étapes de « Comment ça marche ».
const ETAPES = [
  { titre: 'Crée ton compte', desc: 'Un mois offert, sans carte bancaire.' },
  { titre: 'Configure ta page', desc: 'Tes prestations, tes prix, tes horaires et ta zone. Compte une dizaine de minutes.' },
  { titre: 'Partage ton lien', desc: 'Instagram, TikTok, Google, ton site : les réservations arrivent dans ton agenda.' },
]

// Les trois étapes du mécanisme des créneaux groupés, sous l'encart dégradé.
// Reprend en schéma ce que le paragraphe de la section décrit déjà en prose,
// dans le même esprit que ETAPES ci-dessus. Demande de Ryan le 2026-09-27 :
// la section « une info toute seule » manquait d'un déroulé concret.
const ETAPES_CRENEAUX = [
  { titre: 'Le client réserve', desc: 'Il indique son adresse en réservant, comme pour n’importe quel rendez-vous — rien à cocher de ton côté.' },
  { titre: 'WashBoard compare les trajets', desc: 'L’adresse est comparée, via Google Maps, au trajet réel jusqu’à tous tes rendez-vous déjà prévus ce jour-là.' },
  { titre: 'Les créneaux proches ressortent', desc: 'Les horaires sous ton seuil (5 à 30 minutes) sont mis en avant au client, avec ta remise si tu en as réglé une.' },
]

// Développé le 2026-09-27 (Ryan : « c'est vraiment le cœur du truc, le
// tout-en-un »), puis refait le même jour : la première version listait ce
// que fait chaque étape (Réservation, Client, Fidélisation...) — mais c'est
// exactement ce que disent déjà l'encart Facturation juste en dessous et la
// grille « Et tout le reste » plus bas (Ryan : « une répétition de ce qu'il
// y a juste en dessous »). Le vrai argument tout-en-un n'est pas la liste des
// fonctionnalités, déjà faite ailleurs — c'est qu'une seule donnée traverse
// toutes les étapes sans ressaisie. Ce parcours le montre avec UN exemple fil
// rouge (même cliente, même prix, du premier clic à la relance) plutôt qu'un
// inventaire. Prix et compteur de visites sont illustratifs, comme le mockup
// déjà utilisé plus bas pour les créneaux groupés — pas des chiffres
// commerciaux (voir lib/plan.ts pour ceux-là).
const PARCOURS_TOUT_EN_UN = [
  'Mardi 14h : Sophie B. réserve un lavage complet sur ta page — 45€, elle choisit elle-même son créneau.',
  'Le rendez-vous tombe directement dans ton agenda du mardi, une notification t’arrive aussitôt, sans que tu aies rien à recopier.',
  'Tu interviens chez elle à l’heure prévue : l’adresse et la prestation viennent de sa réservation, rien à ressaisir.',
  'Sa fiche client s’actualise toute seule : c’est sa 3ᵉ visite, 135€ dépensés chez toi au total.',
  'Tu marques le rendez-vous « Terminé » : la facture des 45€ part directement, une demande d’avis Google suit.',
  'Si elle ne revient pas d’ici 3 mois, une relance repart vers elle sans que tu aies à t’en souvenir (Pro).',
]

// Métiers de la section « Pour qui ? ». WashBoard n'en impose aucun : le
// laveur crée ses catégories et prestations, la liste sert d'exemples.
//
// `theme` relie une carte à sa page métier dédiée (@/lib/metiers) quand elle
// existe : voir metierPageForTheme plus bas. Une carte sans page correspondante
// (aucune entrée dans METIER_PAGES, ou pas de theme du tout comme « Et ton
// métier ») reste un simple encart, sans lien.
const METIERS: { titre: string; desc: string; theme?: Theme }[] = [
  { titre: 'Lavage auto & detailing', desc: 'Intérieur, extérieur, rénovation, par véhicule ou en pack.', theme: 'auto' },
  { titre: 'Canapés & textiles', desc: 'Canapés, matelas, tapis et moquettes, chez le client.', theme: 'textiles' },
  { titre: 'Et ton métier', desc: 'Catégories, prestations, durées et prix : tout se configure.' },
]

// Sections reprises dans la nav, dans l'ordre de la page. Les `id` sont ceux
// des <section> plus bas.
const SECTIONS_NAV = [
  { id: 'fonctionnalites', label: 'Fonctionnalités' },
  { id: 'tutoriel', label: 'Tutoriel' },
  { id: 'tarifs', label: 'Tarifs' },
  { id: 'faq', label: 'FAQ' },
] as const

// Capture du produit, en clair et en sombre selon le thème du visiteur. Les
// images sont prises sur des bancs locaux avec des données de démonstration :
// jamais sur un vrai compte (noms de clients, données d'un laveur).
function Capture({ clair, sombre, largeur, hauteur, alt, legende, className = '', sizes }: {
  clair: string; sombre: string; largeur: number; hauteur: number; alt: string; legende: string; className?: string; sizes: string
}) {
  return (
    <FadeUp className={className}>
      <figure>
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <Image src={clair} alt={alt} width={largeur} height={hauteur} sizes={sizes} className="w-full h-auto dark:hidden" />
          <Image src={sombre} alt={alt} width={largeur} height={hauteur} sizes={sizes} className="w-full h-auto hidden dark:block" />
        </div>
        <figcaption className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{legende}</figcaption>
      </figure>
    </FadeUp>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-9 h-9" />
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
      aria-label="Changer de thème"
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
      )}
    </button>
  )
}

export default function LandingPage() {
  // L'annuel est présélectionné : c'est l'offre qu'on met en avant.
  const [billing, setBilling] = useState<BillingCycle>('yearly')
  const rdvBusiness = lienRendezVousBusiness()
  const rdvExterne = rendezVousExterne(rdvBusiness)

  // La nav reprend le bleu ciel du hero ; passé le hero il n'y a plus de
  // dégradé derrière elle, elle doit donc devenir opaque. Un observateur évite
  // d'écouter le scroll en continu.
  //
  // On observe le hero entier, et non une sentinelle d'un pixel en fin de hero.
  // Sur un écran de moins de ~770 px de haut, la sentinelle démarrait sous
  // l'écran : la nav s'affichait opaque dès l'ouverture, et un défilement
  // rapide la faisait passer au-dessus sans jamais la rendre visible, donc sans
  // aucun signal. Le hero, lui, est toujours visible à l'ouverture (il commence
  // en haut de page) : le quitter, même d'un coup, est toujours signalé.
  const hero = useRef<HTMLElement>(null)
  const [pastHero, setPastHero] = useState(false)
  useEffect(() => {
    const cible = hero.current
    if (!cible) return
    // Marge haute = hauteur de la nav : « dépassé » quand le bas du hero est
    // remonté sous la nav.
    const obs = new IntersectionObserver(
      ([e]) => setPastHero(!e.isIntersecting),
      { rootMargin: '-64px 0px 0px 0px' },
    )
    obs.observe(cible)
    return () => obs.disconnect()
  }, [])

  // Section en cours de lecture, surlignée dans la nav : la dernière dont le
  // haut est passé au-dessus du milieu de l'écran (aucune au-dessus des
  // fonctionnalités). Calculée d'après la position de défilement, et non par
  // entrée/sortie de l'écran : un saut rapide ne peut pas la faire rater.
  // Un calcul au plus par image affichée.
  const [sectionActive, setSectionActive] = useState<string | null>(null)
  useEffect(() => {
    let image = 0
    const calculer = () => {
      image = 0
      const repere = window.innerHeight * 0.45
      let active: string | null = null
      for (const { id } of SECTIONS_NAV) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= repere) active = id
      }
      setSectionActive(active)
    }
    const planifier = () => { if (!image) image = requestAnimationFrame(calculer) }
    planifier()
    window.addEventListener('scroll', planifier, { passive: true })
    window.addEventListener('resize', planifier)
    return () => {
      window.removeEventListener('scroll', planifier)
      window.removeEventListener('resize', planifier)
      if (image) cancelAnimationFrame(image)
    }
  }, [])

  // Défilement doux vers la section (instantané si l'utilisateur réduit les
  // animations). `scroll-mt-20` sur les sections évite qu'elles passent sous
  // la nav collante. L'adresse prend l'ancre sans ajouter d'entrée d'historique.
  function allerA(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-300 overflow-x-clip">
      <style>{`
        /* Gleam sections body (fond clair) */
        .wb-gleam {
          background: linear-gradient(90deg, #1651E8 0%, #1651E8 22%, #00C4D4 40%, #CCF5FF 50%, #00C4D4 60%, #1651E8 78%, #1651E8 100%);
          background-size: 300% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: washGleam 4.5s ease-in-out infinite; display: inline;
        }
        .dark .wb-gleam {
          background: linear-gradient(90deg, #4A81FF 0%, #4A81FF 22%, #00C4D4 40%, #CCF5FF 50%, #00C4D4 60%, #4A81FF 78%, #4A81FF 100%);
          background-size: 300% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: washGleam 4.5s ease-in-out infinite; display: inline;
        }
        /* Gleam hero — s'adapte au thème */
        .hero-hl {
          background: linear-gradient(90deg, #1651E8 0%, #1651E8 22%, #00C4D4 40%, #CCF5FF 50%, #00C4D4 60%, #1651E8 78%, #1651E8 100%);
          background-size: 300% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: washGleam 4.5s ease-in-out infinite; display: inline;
        }
        .dark .hero-hl {
          background: linear-gradient(90deg, #fff 0%, #fff 22%, #00C4D4 40%, #AAFCFF 50%, #00C4D4 60%, #fff 78%, #fff 100%);
          background-size: 300% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: washGleam 4.5s ease-in-out infinite; display: inline;
        }
        @keyframes washGleam {
          0% { background-position: -100% center; }
          100% { background-position: 200% center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wb-gleam { animation: none; background: none; -webkit-text-fill-color: #1651E8; }
          .dark .wb-gleam { -webkit-text-fill-color: #4A81FF; }
          .hero-hl { animation: none; background: none; -webkit-text-fill-color: #1651E8; }
          .dark .hero-hl { -webkit-text-fill-color: #ffffff; }
        }
        /* Nav — suit le thème */
        /* La nav reprend exactement la couleur de depart du hero (opaque, sans
           filet) : toute transparence ou bordure recreerait une demarcation */
        .wb-nav {
          background: #EBF5FF;
          border-bottom: none;
        }
        .dark .wb-nav {
          background: #09111E;
          border-bottom: none;
        }
        /* Passé le hero : plus de dégradé derrière la nav, elle devient opaque
           et gagne un filet, sans quoi une nav blanche sur fond blanc serait
           impossible à distinguer du contenu. */
        .wb-nav-solid {
          background: rgba(255, 255, 255, 0.92);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }
        .dark .wb-nav-solid {
          background: rgba(2, 6, 23, 0.92);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        /* Hero — suit le thème. Dégradé vertical (et non diagonal) pour que la
           toute premiere ligne du hero soit uniforme et colle exactement a la
           couleur de la nav : un degrade diagonal la ferait varier en largeur. */
        .wb-hero {
          background: linear-gradient(to bottom, #EBF5FF 0%, #F4F9FF 45%, #FFFFFF 100%);
        }
        .dark .wb-hero {
          background: linear-gradient(to bottom, #09111E 0%, #0C1D38 65%, #020617 100%);
        }
        /* Dégradé radial aqua — fond clair uniquement. Masque en haut pour que
           le halo n'apporte rien sur la ligne de jonction avec la nav. */
        .wb-hero-glow {
          background: radial-gradient(ellipse 75% 50% at 50% -5%, rgba(0, 196, 212, 0.13), transparent);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 30%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 30%);
        }
        .dark .wb-hero-glow { background: none; }

        /* TEST — ciel étoilé + nuages qui dérivent, dark mode uniquement */
        .wb-stars {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1.6px 1.6px at 8% 14%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1.4px 1.4px at 22% 26%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.2px 1.2px at 35% 9%, rgba(255,255,255,0.85), transparent),
            radial-gradient(1.6px 1.6px at 48% 31%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.2px 1.2px at 62% 16%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1.5px 1.5px at 75% 23%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.2px 1.2px at 88% 11%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.5px 1.5px at 15% 41%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.2px 1.2px at 93% 38%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.6px 1.6px at 56% 46%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.2px 1.2px at 4% 33%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.4px 1.4px at 68% 5%, rgba(255,255,255,0.7), transparent);
          background-repeat: no-repeat;
          animation: wbStarTwinkle 4.5s ease-in-out infinite;
        }
        @keyframes wbStarTwinkle {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        /* Photo de ciel en FOND du hero entier (comme peekly.app), et non une
           bande en bas : c'est l'arriere-plan qui porte l'ambiance, le contenu
           passe par-dessus. Cadrage qui derive tres lentement, pour du mouvement
           sans distraction. */
        .wb-cloud-photo {
          position: absolute;
          inset: 0;
          background-image: url('/hero-clouds.jpg');
          background-size: cover;
          background-position: center 62%;
          animation: wbCloudPhotoDrift 110s ease-in-out infinite;
        }
        .dark .wb-cloud-photo {
          filter: brightness(0.6) saturate(0.45) contrast(1.05);
        }
        /* Voile teinte par-dessus la photo : ramene le ciel aux couleurs de la
           marque et garantit le contraste du texte, quelle que soit la zone de
           l'image qui se trouve derriere. */
        .wb-cloud-tint {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom,
            rgba(235,245,255,0.85) 0%,
            rgba(240,247,255,0.55) 30%,
            rgba(248,252,255,0.3) 60%,
            rgba(255,255,255,0.15) 100%);
        }
        .dark .wb-cloud-tint {
          background: linear-gradient(to bottom,
            rgba(9,17,30,0.9) 0%,
            rgba(12,29,56,0.7) 30%,
            rgba(6,16,34,0.42) 60%,
            rgba(2,6,23,0.25) 100%);
        }
        /* Ecrans etroits : le hero est ~70% plus haut que sur desktop, et en
           « cover » la photo se cale sur la hauteur — on ne voit alors qu une bande
           de 18% de sa largeur, prise au milieu, la ou il n y a que du ciel.
           On la zoome et on l ancre en bas pour cadrer sur les nuages. La derive
           est coupee : elle se battrait avec ce background-position, et elle
           n apporte rien sur mobile. */
        @media (max-width: 640px) {
          .wb-cloud-photo {
            background-size: auto 155%;
            background-position: center bottom;
            animation: none;
          }
        }
        @keyframes wbCloudPhotoDrift {
          0%, 100% { background-position: center 62%; }
          50% { background-position: 56% 56%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wb-stars, .wb-cloud-photo { animation: none; }
        }
        /* Raccord vers la section blanche qui suit : la photo descend jusqu'en
           bas du hero, le fondu est donc necessaire dans les deux themes. */
        .wb-cloud-fade-white {
          background: linear-gradient(to bottom, transparent 0%, transparent 58%, #FFFFFF 100%);
        }
        .dark .wb-cloud-fade-white {
          background: linear-gradient(to bottom, transparent 0%, transparent 64%, #FFFFFF 100%);
        }
        /* Cadre des vraies captures produit dans le hero — même esprit que
           l'ancienne carte planning (fond léger, bordure fine, ombre douce)
           mais autour d'une image plutôt que d'une maquette inventée. */
        .wb-hero-shot {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(22, 81, 232, 0.10);
          box-shadow: 0 4px 24px rgba(22, 81, 232, 0.06);
        }
        .dark .wb-hero-shot {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.10);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
        }
      `}</style>

      {/* ── Nav ── */}
      <nav className={`wb-nav ${pastHero ? 'wb-nav-solid' : ''} sticky top-0 z-50 backdrop-blur-md transition-colors`}>
        {/* Pleine largeur : logo au bord gauche, actions au bord droit. Le
            contenu de la page reste, lui, centré dans son conteneur. */}
        <div className="px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={40} height={40} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0 object-contain" />
            <span className="hidden sm:inline text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">WashBoard</span>
          </div>
          {/* Sections de la page, la section en cours surlignée. Ordinateur
              seulement : sur mobile, la place manque à côté des actions. */}
          <div className="hidden lg:flex flex-1 justify-center items-center gap-1">
            {SECTIONS_NAV.map(({ id, label }) => {
              const actif = sectionActive === id
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={e => allerA(e, id)}
                  aria-current={actif ? 'true' : undefined}
                  className={`relative px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    actif
                      ? 'text-[#1651E8] dark:text-white'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                  <span
                    aria-hidden
                    className={`absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-sm bg-[#1651E8] dark:bg-[#00C4D4] transition-opacity ${
                      actif ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </a>
              )
            })}
            {/* Seul lien vers une autre page dans cette nav : sans lui, le blog
                n'est relié au site que par le sitemap, et Google le traite
                comme une page secondaire. */}
            <Link
              href="/blog"
              className="px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Blog
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle />
            <Link href="/login" className="text-sm text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors px-2 sm:px-3 py-2 whitespace-nowrap">
              Connexion
            </Link>
            <Link href="/signup" className="px-3 sm:px-4 py-2 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shadow-sm shadow-[#1651E8]/20">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={hero} className="wb-hero relative px-4 sm:px-6 pt-16 pb-20 sm:pt-20 sm:pb-28">
        {/* Halo aqua — fond clair seulement */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[500px] pointer-events-none overflow-hidden">
          <div className="wb-hero-glow absolute inset-0" />
        </div>

        {/* TEST — nuages (clair + sombre) et étoiles (sombre uniquement) */}
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="wb-cloud-photo" />
          <div className="wb-cloud-tint" />
          <div className="wb-stars hidden dark:block" />
          <div className="wb-cloud-fade-white absolute inset-x-0 bottom-0 h-[340px]" />
        </div>

        {/* z-10 explicite : le texte doit rester au-dessus des nuages quoi qu'il arrive */}
        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            className="grid lg:grid-cols-[1fr_440px] gap-12 lg:gap-16 items-center"
          >
            <div>
              <motion.p
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}
                className="text-xs font-black text-[#1651E8] dark:text-[#00C4D4] uppercase tracking-[0.22em] mb-8"
              >
                Nettoyage & entretien automobile
              </motion.p>
              <motion.h1
                variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
                className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight text-slate-900 dark:text-white mb-8"
              >
                <RotatingHeadline />
              </motion.h1>
              {/* Répond dès le premier écran à « c'est pour qui ? » : le
                  logiciel de gestion des pros qui se déplacent chez leurs
                  clients, métiers cités en clair — pour le visiteur pressé
                  comme pour un moteur qui lit la page. */}
              <motion.p
                variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }}
                className="text-base sm:text-lg text-slate-600 dark:text-white/65 mb-8 max-w-lg leading-relaxed"
              >
                Le logiciel de gestion des pros qui se déplacent chez leurs clients&nbsp;:
                lavage automobile, detailing, canapés & textiles.
                Réservation en ligne, créneaux groupés.
              </motion.p>
              <motion.div
                variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }}
                className="flex flex-wrap items-center gap-5"
              >
                <Link href="/signup" className="px-7 py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/25">
                  Lancer mon mois gratuit
                </Link>
                <Link href="/booking" className="text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white text-sm font-medium transition-colors underline underline-offset-4">
                  ou prendre un appel
                </Link>
              </motion.div>
              <motion.p
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5, delay: 0.3 } } }}
                className="text-xs text-slate-400 dark:text-white/25 mt-5"
              >
                Sans engagement · Sans carte bancaire
              </motion.p>
            </div>

            {/* Aperçu produit — vraies captures d'écran (mêmes fichiers que
                la section « Le produit en vrai » plus bas), pas une maquette
                inventée. Le calendrier illustre déjà le regroupement de
                créneaux par zone (marqué ★ sur la capture) décrit dans le
                texte à gauche. La page de réservation, posée en avant-plan,
                montre ce que voit le client qui réserve. */}
            <motion.div
              variants={{ hidden: { opacity: 0, x: 24 }, visible: { opacity: 1, x: 0, transition: { duration: 0.7, delay: 0.15 } } }}
              className="relative max-w-[380px] mx-auto lg:max-w-none lg:mx-0 pb-10 sm:pb-14 lg:pb-16"
            >
              <div className="wb-hero-shot rounded-2xl overflow-hidden">
                {/* `priority` : ces deux images sont dans le hero, donc déjà
                    visibles au premier écran. Sans elle, Next.js les charge en
                    lazy comme n'importe quelle image plus bas sur la page —
                    l'espace réservé par `width`/`height` ne suffit pas à lui
                    seul, mesuré en conditions dégradées (4G lente + CPU x4) :
                    le bloc image restait quasi vide (~40px) jusqu'à ce que le
                    chargement démarre, puis sautait à sa taille réelle
                    (~270px) une fois l'image récupérée — la source du CLS de
                    0,155 relevé le 2026-09-21. */}
                <Image
                  src="/landing/calendrier-clair.webp" alt="Le calendrier WashBoard, avec les créneaux groupés marqués d une étoile"
                  width={1600} height={1240} sizes="(min-width: 1024px) 440px, 90vw" className="w-full h-auto dark:hidden"
                  priority
                />
                <Image
                  src="/landing/calendrier-sombre.webp" alt="Le calendrier WashBoard, avec les créneaux groupés marqués d une étoile"
                  width={1600} height={1240} sizes="(min-width: 1024px) 440px, 90vw" className="w-full h-auto hidden dark:block"
                  priority
                />
              </div>
              <div className="wb-hero-shot absolute -bottom-2 -left-4 sm:-left-6 w-[42%] max-w-[190px] rounded-2xl overflow-hidden">
                <Image
                  src="/landing/reservation-clair.webp" alt="La page de réservation WashBoard, côté client, sur téléphone"
                  width={600} height={1000} sizes="190px" className="w-full h-auto dark:hidden"
                  priority
                />
                <Image
                  src="/landing/reservation-sombre.webp" alt="La page de réservation WashBoard, côté client, sur téléphone"
                  width={600} height={1000} sizes="190px" className="w-full h-auto hidden dark:block"
                  priority
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Pain points — bande toujours blanche, meme en dark mode ── */}
      <section className="relative bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
          <FadeUp>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.22em] mb-12">
              Ce que tu fais encore à la main
            </p>
          </FadeUp>
          <div className="divide-y divide-slate-200">
            {[
              {
                n: '01',
                title: 'Tu gères les réservations sur WhatsApp',
                desc: 'Un RDV confirmé = 4 messages échangés. Multiplié par 8 clients par jour, ça fait beaucoup pour pas grand chose.',
              },
              {
                n: '02',
                title: 'Tes trajets ne sont pas optimisés',
                desc: 'Bordeaux Nord à 9h, Bordeaux Sud à 10h30. 45 minutes de route entre les deux. Deux fois par semaine, ça chiffre.',
              },
              {
                n: '03',
                title: 'Tu estimes ton CA, tu ne le sais pas vraiment',
                desc: 'Tu penses avoir fait 1 400€ cette semaine. Tu vérifies en fin de mois et c\'est rarement ce que tu pensais.',
              },
              {
                n: '04',
                title: 'Un client qui ne revient pas, tu ne le vois pas passer',
                desc: 'Pas d\'alerte, pas de relance : le client parti depuis 3 mois se noie dans les autres, jusqu\'à ce qu\'un concurrent le récupère avant toi.',
              },
            ].map((pain) => (
              <FadeUp
                key={pain.n}
                className="py-8 sm:py-10 grid grid-cols-[3.5rem_1fr] sm:grid-cols-[5rem_1fr_2fr] gap-x-6 sm:gap-x-10 gap-y-1 items-start"
              >
                <span className="text-4xl sm:text-6xl font-black text-[#1651E8]/25 leading-none row-span-2 sm:row-span-1 pt-0.5">
                  {pain.n}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{pain.title}</h3>
                <p className="col-start-2 sm:col-start-3 sm:row-start-1 text-slate-500 leading-relaxed text-sm sm:text-base">
                  {pain.desc}
                </p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pour qui ── */}
      <section id="pour-qui" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <FadeUp className="mb-12">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Pour qui ?</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl">
            Le logiciel des pros du lavage auto et du detailing.
          </h2>
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
            Une activité annexe comme les canapés, ou un métier voisin ? Tu crées tes propres catégories et prestations&nbsp;: WashBoard s&apos;adapte à ton métier, pas l&apos;inverse.
          </p>
        </FadeUp>
        {/* 3 cartes seulement depuis le recentrage automobile (METIERS) :
            grid-cols-3 partout cassait chaque mot sur un mobile étroit
            (360px, testé), chaque colonne ne faisant plus qu'une centaine de
            pixels. 1 colonne sur mobile, 3 à partir de la tablette — pas
            besoin d'un palier à 2 colonnes intermédiaire pour 3 éléments. */}
        <FadeGroup className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {METIERS.map((m) => {
            // Seuls les métiers avec une page publiée (@/lib/metiers) sont
            // cliquables : un lien vers une page qui n'existe pas dessert plus
            // qu'il n'aide.
            const page = m.theme ? metierPageForTheme(m.theme) : undefined
            const contenu = (
              <>
                <p className="font-bold text-slate-900 dark:text-white">{m.titre}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</p>
                {page && (
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#1651E8] dark:text-[#6A9FFF]">
                    En savoir plus
                    <svg aria-hidden className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </>
            )
            return (
              <FadeItem key={m.titre} className="bg-white dark:bg-slate-950">
                {page ? (
                  <Link
                    href={`/${page.slug}`}
                    className="block h-full p-5 sm:p-6 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1651E8] focus-visible:ring-inset"
                  >
                    {contenu}
                  </Link>
                ) : (
                  <div className="p-5 sm:p-6">{contenu}</div>
                )}
              </FadeItem>
            )
          })}
        </FadeGroup>
      </section>

      {/* ── Features ── */}
      <section id="fonctionnalites" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 pb-24 border-t border-slate-100 dark:border-slate-800/50 pt-24">
        <FadeUp className="mb-14">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Ce qu&apos;on a mis dedans</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-xl">
            L&apos;essentiel. Sans le reste.
          </h2>
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
            Un seul outil pour le pro du lavage automobile : la réservation, l&apos;agenda, les clients
            et les comptes. Pas dix logiciels qui ne se parlent pas.
          </p>
        </FadeUp>

        {/* Renforce « L'essentiel. Sans le reste. » plutôt que de dupliquer une
            section : le mot « tout-en-un » devient lisible dans un titre, et
            le parcours réservation → fidélisation, jusque-là seulement
            implicite dans le paragraphe au-dessus, est montré explicitement. */}
        <FadeUp className="mb-14">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl">
            Un logiciel tout-en-un, de la réservation à la fidélisation.
          </h3>
          <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
            Le client réserve, le rendez-vous tombe dans ton planning, tu interviens chez lui, sa fiche
            se met à jour, WashBoard s&apos;occupe du suivi puis de le faire revenir — un seul outil du
            premier clic à la fidélisation, jamais un logiciel différent à chaque étape.
          </p>
          {/* Une frise, pas une grille : la grille est déjà prise par
              FONCTIONNALITES plus bas, et une deuxième grille aurait
              renforcé l'impression de répétition plutôt que de la corriger. */}
          <p className="mt-10 text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-6">Exemple, du premier clic à la relance</p>
          <div className="max-w-2xl space-y-0">
            {PARCOURS_TOUT_EN_UN.map((etape, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#1651E8] dark:bg-[#6A9FFF] mt-2" />
                  {i < PARCOURS_TOUT_EN_UN.length - 1 && (
                    <span className="w-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  )}
                </div>
                <p className="pb-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{etape}</p>
              </div>
            ))}
          </div>
        </FadeUp>

        {/* Feature phare — la facturation, pas un différenciateur face à la
            concurrence (d'autres outils facturent aussi), mais la preuve la
            plus concrète du tout-en-un : pas de logiciel de facturation à
            payer et à raccorder en plus. Contenu repris de l'ancienne section
            « Facturation » plus bas (id déplacé ici, section retirée pour ne
            pas répéter le même texte deux fois sur la page). */}
        <FadeUp className="mb-4">
          <div
            id="facturation"
            style={{ background: 'linear-gradient(135deg, #0B1828 0%, #0D2248 55%, #0B1828 100%)' }}
            className="scroll-mt-20 border border-white/[0.07] rounded-2xl p-6 sm:p-10 grid sm:grid-cols-2 gap-8 sm:gap-12 items-center"
          >
            <div>
              <p className="text-xs font-black text-[#00C4D4] uppercase tracking-[0.22em] mb-5">Ce qui fait la différence</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">
                La facturation, sans outil en plus
              </h3>
              <p className="text-white/75 leading-relaxed mb-6 text-sm sm:text-base">
                Dès qu&apos;un rendez-vous passe en « Terminé », WashBoard émet la facture avec tes mentions
                obligatoires — SIRET, régime de TVA, numérotation continue attribuée par le système, sans
                trou ni doublon — et l&apos;envoie automatiquement par email à ton client pro. Le particulier,
                lui, la retrouve sur son lien de confirmation. Tes anciennes factures s&apos;importent en PDF
                ou en photo, et se rangent au même endroit que les nouvelles.
              </p>
              <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Un outil de facturation en moins
              </div>
              <p className="mt-4 text-xs text-white/50 leading-relaxed">
                Elle sort du même outil que ton agenda et ton CRM — pas de compte à ouvrir ni de logiciel
                à payer en plus.
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)' }} className="rounded-xl border border-white/[0.08] p-3 sm:p-4">
              <div className="rounded-lg overflow-hidden">
                <Image
                  src="/landing/facture-demo.webp"
                  alt="Une facture WashBoard : SIRET, TVA, numéro continu et détail de la prestation"
                  width={1100} height={980} sizes="(min-width: 640px) 380px, 90vw" className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </FadeUp>

        {/* 3 features secondaires */}
        <FadeGroup className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {[
            {
              iconColor: 'text-[#1651E8] dark:text-[#6A9FFF]',
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
              title: 'Page de réservation',
              desc: 'Ton lien, tes services, tes prix. Le client choisit un créneau et confirme. Toi tu reçois une notif.',
            },
            {
              iconColor: 'text-emerald-500 dark:text-emerald-400',
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
              title: 'Tableau de bord',
              desc: 'CA du jour, de la semaine, du mois. Prochains RDV, clients à relancer. Deux minutes le matin.',
            },
            {
              iconColor: 'text-amber-500 dark:text-amber-400',
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
              title: 'Accompagnement',
              desc: 'Mise en place en 10 minutes. Si tu bloques, WhatsApp direct au 06 84 14 04 38. Inclus dans l\'abo.',
            },
          ].map((feat) => (
            <FadeItem key={feat.title} className="bg-white dark:bg-slate-900/50 p-6 sm:p-7">
              <div className={`w-7 h-7 flex items-center justify-center mb-4 ${feat.iconColor}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>{feat.icon}</svg>
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-wide">{feat.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feat.desc}</p>
            </FadeItem>
          ))}
        </FadeGroup>

        {/* Tout le reste, sans hiérarchie : la liste complète du produit. */}
        <FadeUp className="mt-16 mb-8">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Et tout le reste, dans le même outil.
          </h3>
        </FadeUp>
        {/* Grille classique : chaque ligne s'aligne d'une colonne à l'autre,
            garanti par construction. Un essai précédent avait éclaté cette
            grille en 3 colonnes indépendantes pour effacer le vide que
            laissait la longue description de Facturation — ça a bien effacé
            le vide, mais désaligné toutes les lignes suivantes (Facturation
            traînait en retard sur ses voisines). Revenu à une grille simple :
            le vrai problème était la longueur du texte de Facturation dans
            CETTE liste, raccourci ci-dessus (le détail complet reste dans
            l'encart juste au-dessus, rien n'est perdu). */}
        <FadeGroup className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
          {FONCTIONNALITES.map((f) => <FonctionnaliteItem key={f.titre} f={f} />)}
        </FadeGroup>
      </section>

      {/* ── Le choix + le comparatif ── repris en doublon volontaire de
          /meilleur-logiciel-lavage-auto (données et composant partagés via
          lib/comparatifAuto.ts et components/ComparatifBesoins.tsx) : cette
          page s'est révélée trop convaincante pour rester accessible
          seulement via un lien, elle mérite sa place ici, juste après
          l'inventaire des fonctionnalités. Angle « outils génériques », pas
          de concurrent nommé — voir le header de la page dédiée pour le
          détail juridique. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="mb-14">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Le choix</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl">
            Trois façons de gérer, aucune n&apos;est absurde
          </h2>
        </FadeUp>
        <FadeGroup className="grid sm:grid-cols-3 gap-8 sm:gap-10 mb-16">
          {[
            {
              n: '01',
              titre: 'À la main',
              texte: 'WhatsApp pour les réservations, Excel pour les prix et le suivi, un carnet ou une note pour l’agenda. Zéro coût, zéro mise en place. Tient tant que le volume reste faible et que personne d’autre n’a besoin de lire ces informations.',
            },
            {
              n: '02',
              titre: 'Un outil généraliste',
              texte: 'Calendly ou un agenda Google partagé gèrent très bien la prise de rendez-vous en ligne sans échange de messages. Ils ne savent en revanche rien du métier : ni du véhicule, ni du trajet, ni de la facture qui doit suivre.',
            },
            {
              n: '03',
              titre: 'Un logiciel dédié',
              texte: 'Pensé pour une activité qui se déplace : prix par véhicule, frais de déplacement, créneaux qui limitent la route, facture conforme. Le compromis : un abonnement, et une mise en place initiale.',
            },
          ].map((etape) => (
            <FadeItem key={etape.n}>
              <span className="text-3xl font-black text-[#1651E8]/25 leading-none">{etape.n}</span>
              <p className="mt-3 font-bold text-slate-900 dark:text-white">{etape.titre}</p>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{etape.texte}</p>
            </FadeItem>
          ))}
        </FadeGroup>

        <FadeUp className="mb-8">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Poste par poste</p>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-4">
            Ce qui change vraiment selon l&apos;outil
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Pas de note globale ni de verdict à l&apos;emporte-pièce : chaque besoin, comparé pour ce qu&apos;il
            est. Un outil comme Calendly fait très bien la prise de rendez-vous simple — l&apos;écart se joue
            ailleurs.
          </p>
        </FadeUp>
        <FadeUp>
          <ComparatifBesoins head={besoinsHead} rows={besoinsRows} />
          <Link
            href="/meilleur-logiciel-lavage-auto"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline underline-offset-4"
          >
            Voir le comparatif complet, avec la foire aux questions
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </FadeUp>
      </section>

      {/* ── Le produit en vrai ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="mb-12">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Le produit en vrai</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl">
            Ce que voient tes clients. Ce que tu vois, toi.
          </h2>
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
            Captures de WashBoard, avec des données de démonstration.
          </p>
        </FadeUp>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-10 items-start">
          <div className="space-y-10 min-w-0">
            <Capture
              clair="/landing/calendrier-clair.webp" sombre="/landing/calendrier-sombre.webp" largeur={1600} hauteur={1240}
              alt="Le calendrier WashBoard : les rendez-vous du mois, les créneaux groupés et les congés"
              legende="Ton agenda : les réservations du mois, les créneaux groupés (★) et tes congés."
              sizes="(min-width: 1024px) 760px, 100vw"
            />
            <Capture
              clair="/landing/crm-clair.webp" sombre="/landing/crm-sombre.webp" largeur={1600} hauteur={498}
              alt="Le CRM WashBoard : visiteurs et réservations de la page, jour après jour"
              legende="Ton CRM : les visiteurs de ta page et les réservations, jour après jour."
              sizes="(min-width: 1024px) 760px, 100vw"
            />
          </div>
          <Capture
            clair="/landing/reservation-clair.webp" sombre="/landing/reservation-sombre.webp" largeur={600} hauteur={1000}
            alt="La page de réservation WashBoard sur téléphone, côté client"
            legende="Ta page de réservation, côté client : prestation, créneau, coordonnées. Sans compte à créer."
            className="max-w-[280px] mx-auto lg:mx-0 w-full"
            sizes="280px"
          />
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="mb-12">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Comment ça marche</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Ta page en ligne en 10 minutes.
          </h2>
        </FadeUp>
        <FadeGroup className="grid sm:grid-cols-3 gap-8 sm:gap-10">
          {ETAPES.map((e, i) => (
            <FadeItem key={e.titre}>
              <span className="text-4xl sm:text-5xl font-black text-[#1651E8]/25 leading-none">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-3 font-bold text-slate-900 dark:text-white">{e.titre}</p>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{e.desc}</p>
            </FadeItem>
          ))}
        </FadeGroup>
      </section>

      {/* ── Créneaux groupés — reprend maintenant le même habillage (dégradé
          marine, tag turquoise) que l'encart Facturation juste au-dessus.
          Ryan revient sur le style neutre posé précédemment (voir l'ancien
          historique) : les deux arguments doivent avoir le même poids
          visuel. Le tag reprend l'ancien libellé de section (« Créneaux
          groupés ») plutôt que de répéter « Ce qui fait la différence »
          juste après la facturation. Mockup d'agenda inchangé dans son
          contenu (mêmes chiffres vérifiés que le texte, remise optionnelle
          sur un seul des deux créneaux rapprochés) : ses couleurs sont
          désormais figées en teintes sombres, puisque le fond l'est en
          permanence et ne suit plus le thème clair/sombre du visiteur. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp>
          <div
            style={{ background: 'linear-gradient(135deg, #0B1828 0%, #0D2248 55%, #0B1828 100%)' }}
            className="border border-white/[0.07] rounded-2xl p-6 sm:p-10 grid sm:grid-cols-2 gap-8 sm:gap-12 items-center"
          >
            <div>
              <p className="text-xs font-black text-[#00C4D4] uppercase tracking-[0.22em] mb-5">Créneaux groupés</p>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">
                Deux rendez-vous proches, un trajet en moins.
              </h2>
              <p className="text-white/75 leading-relaxed mb-6 text-sm sm:text-base">
                Quand un client réserve, WashBoard compare son adresse au temps de trajet réel jusqu&apos;à tes
                rendez-vous déjà prévus ce jour-là — pas à un découpage de quartier sur une carte. En dessous du
                seuil que tu règles toi-même, de 5 à 30 minutes de route, les horaires juste avant ou juste après
                un rendez-vous existant sont mis en avant au client, avec la remise que tu as réglée si tu en as
                réglé une — en euros ou en pourcentage, à toi de choisir.
              </p>
              <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold">
                <svg aria-hidden className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Une protection qui tourne même sans remise activée
              </div>
              <p className="mt-4 text-xs text-white/50 leading-relaxed">
                WashBoard ne propose jamais à un client un horaire que le trajet réel rendrait injoignable
                entre deux rendez-vous prévus le même jour — cette vérification tourne à chaque réservation.
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)' }} className="rounded-xl border border-white/[0.08] p-3 sm:p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black text-white/40 uppercase tracking-wider">
                  Bordeaux Sud — aujourd&apos;hui
                </p>
                <span className="text-[10px] font-bold text-white/40 shrink-0">Seuil : 15 min</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { time: '09:00', label: 'Martin D. — Lavage extérieur', type: 'normal' },
                  { time: '10:00', label: 'Sophie B. — Lavage complet', type: 'smart', note: '−8€' },
                  { time: '10:45', label: 'Paul R. — Lavage extérieur', type: 'smart' },
                  { time: '14:00', label: 'Lucie M. — Pack famille', type: 'normal' },
                ].map((item) => (
                  <div
                    key={item.time}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${item.type === 'smart' ? 'bg-[#6A9FFF]/10' : 'bg-white/[0.03]'}`}
                  >
                    <span className="text-xs font-mono text-white/40 shrink-0">{item.time}</span>
                    <span className="text-xs text-white/80 flex-1 truncate">{item.label}</span>
                    {item.type === 'smart' && (
                      <span className="text-xs font-bold text-[#6A9FFF] shrink-0">{item.note ?? 'proche'}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-white/30 leading-relaxed">
                Exemple illustratif — la remise est optionnelle, tu peux ne jamais l&apos;activer.
              </p>
            </div>
          </div>
        </FadeUp>

        {/* Approfondissement du mécanisme ci-dessus, en registre normal (pas
            de dégradé sombre) : le fond dégradé reste réservé à l'argument
            phare, ces deux blocs sont un développement, pas une répétition.
            Ajout demandé par Ryan le 2026-09-27. */}
        <div className="mt-14 sm:mt-16">
          <FadeUp className="mb-10">
            <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Le mécanisme</p>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Comment WashBoard repère un créneau proche.
            </h3>
          </FadeUp>
          <FadeGroup className="grid sm:grid-cols-3 gap-8 sm:gap-10">
            {ETAPES_CRENEAUX.map((e, i) => (
              <FadeItem key={e.titre}>
                <span className="text-4xl sm:text-5xl font-black text-[#1651E8]/25 leading-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mt-3 font-bold text-slate-900 dark:text-white">{e.titre}</p>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{e.desc}</p>
              </FadeItem>
            ))}
          </FadeGroup>
        </div>

        <FadeUp className="mt-14 sm:mt-16">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Un exemple concret</p>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-6 sm:p-8 grid sm:grid-cols-[1fr_auto_1fr] gap-6 sm:gap-8 items-center">
            <div>
              <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Sans créneaux groupés</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Martin D. réserve un lavage extérieur à 9h à Bordeaux Sud. Lucie M. réserve un pack famille à
                14h, à l’autre bout de la zone. Rien ne relie les deux rendez-vous : un aller-retour complet
                s’intercale entre eux dans la journée.
              </p>
            </div>
            <span aria-hidden className="hidden sm:block text-2xl font-black text-slate-300 dark:text-slate-700 justify-self-center">→</span>
            <div>
              <p className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-wider mb-2">Avec créneaux groupés</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Sophie B. réserve en ligne : parmi les horaires proposés, 10h ressort parce que son adresse est
                à quelques minutes de route du rendez-vous de Martin D. à 9h. Elle choisit ce créneau, avec une
                remise puisque tu en as réglé une sur ce cas de figure — un trajet en moins dans ta journée.
              </p>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── ROI ── */}
      <section className="border-t border-slate-100 dark:border-slate-800/50 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Deux exemples côte à côte plutôt qu'un seul isolé : sur grand écran, le
              premier seul laissait tout le bloc de droite vide (signalé par Ryan,
              2026-10-06). Même DA que l'original (vert, gros chiffre, encart « ×…= »)
              pour le second plutôt qu'un visuel différent (capture d'écran, etc.) :
              les deux se lisent comme UNE même démonstration en deux temps
              (combien de rendez-vous en plus → combien ça rapporte), pas deux
              arguments séparés. 45€ repris du panier de Sophie B. dans la frise
              « tout-en-un » plus bas, pour rester cohérent d'un exemple à l'autre
              sur la page plutôt que d'inventer un second chiffre. */}
          <FadeUp className="mb-14">
            <div className="grid lg:grid-cols-2 gap-14 lg:gap-10">
              <div className="border-l-4 border-emerald-500 pl-8 sm:pl-12">
                {/* Un exemple de calcul, pas une moyenne mesurée : il n'y a pas encore
                    assez de clients pour en publier une, et l'afficher comme un
                    constat serait trompeur. Le calcul lui-même (2 x 20 = +40 ; 20 jours
                    ouvrés, arrondi courant d'un mois plutôt que les ~22 réels — corrigé le
                    2026-10-06, l'ancienne version disait 2 x 22 et affichait quand même +40) est
                    mis en scène visuellement, pas un graphique qui suggérerait une
                    donnée mesurée dans le temps. */}
                <p className="text-xs font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-[0.22em] mb-5">Exemple de calcul</p>
                <p className="text-7xl sm:text-8xl lg:text-7xl xl:text-8xl font-black text-slate-900 dark:text-white leading-none tracking-tight mb-4">
                  +40
                </p>
                <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-8">rendez-vous en plus par mois</p>

                <div className="inline-flex flex-wrap items-center gap-3 sm:gap-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-5 py-4 sm:px-7 sm:py-5">
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">2</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-tight">rendez-vous<br />de plus / jour</p>
                  </div>
                  <span aria-hidden className="text-xl font-black text-slate-300 dark:text-slate-700">×</span>
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">20</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-tight">jours ouvrés<br />par mois</p>
                  </div>
                  <span aria-hidden className="text-xl font-black text-slate-300 dark:text-slate-700">=</span>
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400">+40</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-tight">rendez-vous<br />par mois</p>
                  </div>
                </div>

                <p className="mt-6 text-sm text-slate-400 dark:text-slate-500 max-w-md leading-relaxed">
                  Un ordre de grandeur, pas une promesse : tout dépend de ta zone et de ta demande.
                </p>
              </div>

              <div className="border-l-4 border-emerald-500 pl-8 sm:pl-12">
                <p className="text-xs font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-[0.22em] mb-5">Et en chiffre d&apos;affaires</p>
                <p className="text-7xl sm:text-8xl lg:text-7xl xl:text-8xl font-black text-slate-900 dark:text-white leading-none tracking-tight mb-4">
                  +1&nbsp;800€
                </p>
                <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-8">par mois, panier moyen 45€</p>

                <div className="inline-flex flex-wrap items-center gap-3 sm:gap-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-5 py-4 sm:px-7 sm:py-5">
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">40</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-tight">rendez-vous<br />en plus</p>
                  </div>
                  <span aria-hidden className="text-xl font-black text-slate-300 dark:text-slate-700">×</span>
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">45€</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-tight">panier<br />moyen</p>
                  </div>
                  <span aria-hidden className="text-xl font-black text-slate-300 dark:text-slate-700">=</span>
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400">1 800€</p>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-tight">par mois<br />en plus</p>
                  </div>
                </div>

                <p className="mt-6 text-sm text-slate-400 dark:text-slate-500 max-w-md leading-relaxed">
                  45€, le prix d&apos;un lavage complet pris en exemple plus bas — le tien peut être différent.
                </p>
              </div>
            </div>
          </FadeUp>

          {/* Trois angles pour répondre à « est-ce que ça vaut le coup »,
              rangés sous le calcul plutôt que dans une seule carte compagne
              qui laissait trop de vide : réassurance (mois offert, sans CB),
              conséquence du +40 côté charge de travail, et un fait produit
              vérifiable (0 ressaisie). Même traitement que « 3 features
              secondaires » plus haut (boîte à colonnes divisées). */}
          <FadeGroup className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <FadeItem className="bg-white dark:bg-slate-900/50 p-6 sm:p-7">
              <p className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-wide mb-3">Tu hésites encore ?</p>
              <p className="font-bold text-slate-900 dark:text-white mb-3">Rien à perdre à essayer</p>
              <ul className="space-y-1.5 mb-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                <li>Un mois offert</li>
                <li>Sans carte bancaire, sans engagement</li>
                <li>Accompagnement inclus, par WhatsApp</li>
              </ul>
              <Link href="/signup" className="text-sm font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline underline-offset-4">
                Lancer mon mois gratuit →
              </Link>
            </FadeItem>

            <FadeItem className="bg-white dark:bg-slate-900/50 p-6 sm:p-7">
              <p className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-wide mb-3">Autre effet du +40</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tight mb-2">+40</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">factures envoyées sans y penser</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Facture et demande d&apos;avis Google partent seules à chaque rendez-vous terminé.
              </p>
            </FadeItem>

            <FadeItem className="bg-white dark:bg-slate-900/50 p-6 sm:p-7">
              <p className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-wide mb-3">Ce qui ne change jamais</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tight mb-2">0</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">information à ressaisir à la main</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Adresse, prestation, prix : tout vient de la réservation du client, jusqu&apos;à la facture.
              </p>
            </FadeItem>
          </FadeGroup>
        </div>
      </section>

      {/* ── Tutoriel ── */}
      <section id="tutoriel" className="scroll-mt-20 max-w-4xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="mb-10 text-center">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Tutoriel</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            WashBoard en 2 minutes
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400 text-base max-w-xl mx-auto">
            Page de réservation, agenda, CRM — vois comment ça fonctionne avant même de t&apos;inscrire.
          </p>
        </FadeUp>
        <FadeUp>
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
            <video
              src="/tuto.mp4"
              controls
              playsInline
              preload="none"
              // Pas de `poster` : aucune image existante dans public/ ne
              // correspond à une vraie vignette de cette vidéo (les captures
              // de landing/ sont au mauvais format — écran de téléphone ou
              // calendrier — pas un cadre 16/9 représentatif). `preload="none"`
              // seul évite déjà le téléchargement silencieux des métadonnées
              // par défaut du navigateur ; le fond `#09111E` occupe l'espace
              // réservé par `aspectRatio` en attendant un clic.
              className="w-full block"
              style={{ aspectRatio: '16/9', background: '#09111E' }}
            />
          </div>
        </FadeUp>
      </section>

      {/* ── Pricing ── */}
      <section id="tarifs" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="mb-8">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Les formules</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Commence gratuitement. Tu paies quand ça remplit.
          </h2>
        </FadeUp>

        <FadeUp className="mb-12">
          <BillingToggle value={billing} onChange={setBilling} />
        </FadeUp>

        {/* Calculés une fois : l'adresse du rendez-vous, et s'il sort du site. */}
        <FadeGroup className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {PLAN_CARDS.map((card) => {
            const featured = !!card.highlight
            // Une offre gratuite n'a ni tarif annuel, ni mois offert : tout ce
            // qui parle d'engagement doit se taire sur cette carte.
            const yearly = billing === 'yearly' && card.price > 0 && !card.surDevis
            return (
              <FadeItem
                key={card.key}
                className={`relative flex flex-col rounded-2xl p-6 sm:p-8 ${featured ? 'border border-white/[0.08]' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}
                style={featured ? { background: 'linear-gradient(135deg, #0B1828 0%, #0D2248 100%)' } : undefined}
              >
                {/* Dans la carte, en haut à droite — plus à cheval sur son bord.
                    À cheval, la moitié du badge flottait dans un écart de 24 px
                    et frôlait la carte du dessus : sur téléphone, où les cartes
                    s'empilent, il donnait l'impression d'une étiquette décollée
                    entre deux offres. Ici il ne déborde de rien, et les prix des
                    quatre cartes restent alignés — un badge inséré dans le flux
                    aurait poussé la carte Pro vers le bas toute seule. */}
                {featured && (
                  <span className="absolute top-4 right-4 bg-[#1651E8] text-white text-[11px] font-bold px-3 py-1 rounded-full">
                    Le plus populaire
                  </span>
                )}
                <p className={`flex items-center gap-2 text-base font-bold mt-2 ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {/* La pastille accompagne le nom, elle ne le remplace pas :
                      seule, elle ne dirait rien à un laveur daltonien. */}
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PLAN_COULEURS[card.key] }}
                    aria-hidden
                  />
                  {card.name}
                </p>
                {/* Business n'affiche pas de tarif : son prix dépend de la
                    taille de l'équipe, et une équipe se chiffre après l'avoir
                    écoutée. Un « dès 129 € » attirait les mauvaises questions
                    (« pourquoi si cher ? ») avant qu'on ait pu poser les
                    bonnes (« vous êtes combien sur la route ? »). */}
                <p className={`text-4xl font-black mt-2 ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {card.surDevis ? LIBELLE_CONTACT : card.price === 0 ? 'Gratuit' : (
                    <>
                      {card.from && <span className={`text-base font-medium ${featured ? 'text-white/45' : 'text-slate-400'}`}>dès </span>}
                      {yearly ? formatEuros(yearlyMonthlyEquivalent(card.price)) : card.price}€
                      <span className={`text-base font-medium ${featured ? 'text-white/45' : 'text-slate-400'}`}>/mois</span>
                    </>
                  )}
                </p>
                <p className={`text-xs mt-1.5 font-semibold ${featured ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {card.surDevis
                    ? `Un échange de ${RDV_BUSINESS_MINUTES} minutes, puis un devis`
                    : card.price === 0
                    ? 'Sans carte bancaire, sans limite de durée'
                    : yearly
                      ? `Soit ${formatEuros(yearlyPrice(card.price))}€/an — ${freeMonthsLabel()}`
                      : `Passez à l’année : ${formatEuros(yearlyMonthlyEquivalent(card.price))}€/mois`}
                </p>
                <p className={`text-sm mt-1 mb-6 ${featured ? 'text-white/60' : 'text-slate-500 dark:text-slate-400'}`}>{card.tagline}</p>
                <div className="space-y-3 text-left mb-8 flex-1">
                  {card.features.map((feat) => (
                    <div key={feat} className={`flex items-start gap-3 text-sm ${featured ? 'text-white/80' : 'text-slate-700 dark:text-slate-300'}`}>
                      <svg className={`w-4 h-4 shrink-0 mt-0.5 ${featured ? 'text-emerald-400' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feat}
                    </div>
                  ))}
                </div>
                {card.surDevis ? (
                  // Lien externe et non `next/link` : il sort du site, vers un
                  // agenda ou vers WhatsApp. `noopener` par principe sur toute
                  // ouverture d'onglet.
                  <a
                    href={rdvBusiness}
                    {...(rdvExterne ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="block w-full text-center py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {LIBELLE_RDV_BUSINESS}
                  </a>
                ) : (
                  <Link href="/signup" className="block w-full text-center py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors">
                    {card.price === 0 ? 'Je commence gratuitement' : 'Je démarre'}
                  </Link>
                )}
              </FadeItem>
            )
          })}
        </FadeGroup>
        <FadeUp className="mt-8">
          <p className="text-xs text-slate-400">Offre gratuite sans carte bancaire · 1 mois d’essai sur les offres payantes · Support WhatsApp — 06 84 14 04 38</p>
        </FadeUp>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-20 max-w-3xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp>
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-12">Questions</p>
        </FadeUp>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {/* Contenu dans lib/faq.ts, mis à jour pour la grille 2026 lors de
              cette fusion (2026-09-28) : source unique, aussi lue par le
              balisage JSON-LD FAQPage — voir le commentaire de ce fichier. */}
          {FAQ_ITEMS.map((item) => (
            <FadeUp key={item.q} className="py-6 sm:py-7">
              <p className="font-bold text-slate-900 dark:text-white mb-2">{item.q}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.a}</p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div
              style={{ background: 'linear-gradient(135deg, #09111E 0%, #0C1D38 50%, #09111E 100%)' }}
              className="border border-white/[0.06] rounded-2xl p-10 sm:p-16 text-center relative overflow-hidden"
            >
              <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#00C4D4]/8 blur-3xl rounded-full pointer-events-none" />
              <h2 className="relative text-4xl sm:text-5xl font-black tracking-tight mb-5 text-white leading-[1.05]">
                Tu fais le service.<br />
                <span className="text-[#00C4D4]">On gère le reste.</span>
              </h2>
              <p className="relative text-white/60 text-base mb-10 max-w-sm mx-auto">
                Ta page de réservation en ligne en 10 minutes, et ton premier mois offert.
              </p>
              <Link href="/signup" className="relative inline-block px-9 py-4 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/30">
                Lancer WashBoard
              </Link>
              <p className="relative text-xs text-white/25 mt-4">Sans engagement · Sans carte bancaire</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 text-center">
          <p className="text-xs text-slate-400 leading-relaxed">
            WashBoard est le logiciel de gestion dédié aux <strong className="font-medium text-slate-500">professionnels du nettoyage et de l&apos;entretien automobile</strong> — lavage de véhicules, detailing, canapés & textiles. Réservation en ligne, gestion des rendez-vous, CRM et comptabilité — conçu pour les indépendants qui se déplacent chez leurs clients en France.
          </p>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-6">
          <a
            href="https://novaflows.fr/realisations"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 hover:border-[#1651E8]/30 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-all shadow-sm hover:shadow-md group"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 1L9.5 5.5H14L10.5 8.5L12 13L7.5 10L3 13L4.5 8.5L1 5.5H5.5L7.5 1Z"/>
            </svg>
            Conçu par <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-[#1651E8] dark:group-hover:text-[#6A9FFF] transition-colors">NovaFlows</span>
          </a>
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WashBoard sur ${social.name}`}
                className="flex items-center justify-center w-11 h-11 rounded-full text-slate-500 dark:text-slate-400 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {social.icon}
              </a>
            ))}
          </div>
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/LogoWashBoard.png" alt="WashBoard" width={24} height={24} className="rounded-md" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">WashBoard</span>
            </div>
            <p className="text-xs text-slate-400">© 2026 WashBoard · Logiciel pour pros du lavage automobile · Tous droits réservés</p>
            {/* `flex-wrap` : la rangée se mesurait 366 px de contenu dans une
                fenêtre de 390 px, donc déjà rognée sur un téléphone, et le
                lien « Tous les métiers » la portait à 421 px — « Connexion »
                coupé à gauche, « Confidentialité » à droite. Même motif que le
                pied de page des pages métier (MetierPageTemplate). */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
              <Link href="/login" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Connexion</Link>
              <Link href="/signup" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Inscription</Link>
              <Link href="/blog" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Blog</Link>
              <Link href="/meilleur-logiciel-lavage-auto" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Comparatif</Link>
              <Link href="/mentions-legales" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Mentions légales</Link>
              <Link href="/cgv" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">CGV</Link>
              <Link href="/confidentialite" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Confidentialité</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
