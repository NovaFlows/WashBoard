'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from '@/components/ui/ThemeProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { PLAN_CARDS } from '@/lib/plan'

// Slogans courts et uniformes — pas de saut de layout
const SLOGANS: { pre: string; hl: string; post: string }[] = [
  { pre: 'Lave plus. ', hl: 'Roule moins.', post: '' },
  { pre: 'Tes clients réservent seuls. ', hl: 'Toi tu encaisses.', post: '' },
  { pre: 'Un quartier, un trajet, ', hl: 'trois lavages.', post: '' },
]

function RotatingHeadline() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI(p => (p + 1) % SLOGANS.length), 4500)
    return () => clearInterval(id)
  }, [])
  const s = SLOGANS[i]
  return (
    <span className="block relative min-h-[2.2em]">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="block"
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
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-300 overflow-x-hidden">
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
        .wb-nav {
          background: rgba(255, 255, 255, 0.94);
          border-bottom: 1px solid rgba(0, 0, 0, 0.07);
        }
        .dark .wb-nav {
          background: rgba(9, 17, 30, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        /* Hero — suit le thème */
        .wb-hero {
          background: linear-gradient(140deg, #EBF5FF 0%, #F4F9FF 45%, #FFFFFF 100%);
        }
        .dark .wb-hero {
          background: linear-gradient(150deg, #09111E 0%, #0C1D38 65%, #09111E 100%);
        }
        /* Dégradé radial aqua — fond clair uniquement */
        .wb-hero-glow {
          background: radial-gradient(ellipse 75% 50% at 50% -5%, rgba(0, 196, 212, 0.13), transparent);
        }
        .dark .wb-hero-glow { background: none; }
        /* Carte planning — suit le thème */
        .wb-schedule {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(22, 81, 232, 0.10);
          box-shadow: 0 4px 24px rgba(22, 81, 232, 0.06);
        }
        .dark .wb-schedule {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.10);
          box-shadow: none;
        }
        .wb-schedule-zone { background: rgba(22, 81, 232, 0.05); }
        .dark .wb-schedule-zone { background: rgba(0, 196, 212, 0.08); }
        .wb-schedule-divider { border-top: 1px solid rgba(22, 81, 232, 0.08); }
        .dark .wb-schedule-divider { border-top: 1px solid rgba(255, 255, 255, 0.08); }
      `}</style>

      {/* ── Nav ── */}
      <nav className="wb-nav sticky top-0 z-50 backdrop-blur-md transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={40} height={40} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0 object-contain" />
            <span className="hidden sm:inline text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">WashBoard</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block text-sm text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-2 whitespace-nowrap">
              Connexion
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shadow-sm shadow-[#1651E8]/20">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="wb-hero relative px-4 sm:px-6 pt-16 pb-20 sm:pt-20 sm:pb-28">
        {/* Halo aqua — fond clair seulement */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[500px] pointer-events-none overflow-hidden">
          <div className="wb-hero-glow absolute inset-0" />
        </div>

        <div className="relative max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center"
          >
            <div>
              <motion.p
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}
                className="text-xs font-black text-[#1651E8] dark:text-[#00C4D4] uppercase tracking-[0.22em] mb-8"
              >
                Lavage auto mobile
              </motion.p>
              <motion.h1
                variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
                className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight text-slate-900 dark:text-white mb-8"
              >
                <RotatingHeadline />
              </motion.h1>
              <motion.p
                variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }}
                className="text-base sm:text-lg text-slate-600 dark:text-white/65 mb-10 max-w-md leading-relaxed"
              >
                Réservation en ligne automatique. Créneaux groupés par quartier.
                Tu arrives, tu laves, tu repars.
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

            {/* Planning — sans chrome navigateur */}
            <motion.div
              variants={{ hidden: { opacity: 0, x: 24 }, visible: { opacity: 1, x: 0, transition: { duration: 0.7, delay: 0.15 } } }}
              className="wb-schedule rounded-2xl p-5"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">Mardi 8 juillet</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-white/80 mt-0.5">Bordeaux Sud</p>
                </div>
                <span className="text-xs font-bold text-[#00C4D4] bg-[#00C4D4]/10 px-2.5 py-1 rounded-full shrink-0">3 zones groupées</span>
              </div>
              <div className="space-y-1">
                {[
                  { time: '09:00', name: 'Martin Dupont', service: 'Lavage extérieur', zone: false },
                  { time: '10:00', name: 'Sophie Bernard', service: 'Lavage complet', zone: true },
                  { time: '10:45', name: 'Paul Roche', service: 'Lavage extérieur', zone: true },
                  { time: '13:30', name: 'Lucie Martin', service: 'Pack famille', zone: false },
                  { time: '14:15', name: 'Éric Vidal', service: 'Lavage complet', zone: true },
                  { time: '16:30', name: 'Garage Lefebvre', service: 'Pack entreprise × 4', zone: false },
                ].map((rdv) => (
                  <div key={rdv.time} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${rdv.zone ? 'wb-schedule-zone' : ''}`}>
                    <span className="text-xs font-mono text-slate-400 dark:text-white/40 w-11 shrink-0">{rdv.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white/90 truncate">{rdv.name}</p>
                      <p className="text-xs text-slate-400 dark:text-white/40 truncate">{rdv.service}</p>
                    </div>
                    {rdv.zone ? (
                      <span className="text-xs text-[#00C4D4] font-bold shrink-0">zone</span>
                    ) : (
                      <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
              <div className="wb-schedule-divider mt-4 pt-4 flex items-center justify-between px-1">
                <span className="text-xs text-slate-400 dark:text-white/35">6 lavages · 0 km de plus</span>
                <span className="text-base font-black text-emerald-600 dark:text-white">320€</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <FadeUp>
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-12">
            Ce que tu fais encore à la main
          </p>
        </FadeUp>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
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
          ].map((pain) => (
            <FadeUp
              key={pain.n}
              className="py-8 sm:py-10 grid grid-cols-[3.5rem_1fr] sm:grid-cols-[5rem_1fr_2fr] gap-x-6 sm:gap-x-10 gap-y-1 items-start"
            >
              <span className="text-4xl sm:text-6xl font-black text-[#1651E8]/25 dark:text-[#6A9FFF]/20 leading-none row-span-2 sm:row-span-1 pt-0.5">
                {pain.n}
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{pain.title}</h3>
              <p className="col-start-2 sm:col-start-3 sm:row-start-1 text-slate-500 dark:text-slate-400 leading-relaxed text-sm sm:text-base">
                {pain.desc}
              </p>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 border-t border-slate-100 dark:border-slate-800/50 pt-24">
        <FadeUp className="mb-14">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Ce qu'on a mis dedans</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-xl">
            L'essentiel. Sans le reste.
          </h2>
        </FadeUp>

        {/* Feature phare */}
        <FadeUp className="mb-4">
          <div
            style={{ background: 'linear-gradient(135deg, #0B1828 0%, #0D2248 55%, #0B1828 100%)' }}
            className="border border-white/[0.07] rounded-2xl p-6 sm:p-10 grid sm:grid-cols-2 gap-8 sm:gap-12 items-center"
          >
            <div>
              <p className="text-xs font-black text-[#00C4D4] uppercase tracking-[0.22em] mb-5">Fonctionnalité clé</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">
                Créneaux groupés par zone
              </h3>
              <p className="text-white/75 leading-relaxed mb-6 text-sm sm:text-base">
                Un client réserve rue des Acacias. WashBoard envoie une offre à ses voisins du même bloc. Tu arrives une fois, tu enchaînes 3 lavages. Tu ne bouges pas le van.
              </p>
              <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                +2 lavages/jour en moyenne
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)' }} className="rounded-xl border border-white/[0.08] p-4 space-y-1.5">
              <p className="text-xs font-black text-white/40 uppercase tracking-wider mb-4">Bordeaux Sud — aujourd'hui</p>
              {[
                { time: '09:00', label: 'Martin D. — Lavage extérieur', type: 'normal' },
                { time: '10:00', label: 'Sophie B. — Lavage complet', type: 'smart', note: '−8€ zone' },
                { time: '10:45', label: 'Paul R. — Lavage extérieur', type: 'smart', note: '−5€ zone' },
                { time: '14:00', label: 'Lucie M. — Pack famille', type: 'normal' },
              ].map((item) => (
                <div key={item.time} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${item.type === 'smart' ? 'bg-[#00C4D4]/10' : 'bg-white/[0.03]'}`}>
                  <span className="text-xs font-mono text-white/40 shrink-0">{item.time}</span>
                  <span className="text-xs text-white/80 flex-1 truncate">{item.label}</span>
                  {item.type === 'smart' && (
                    <span className="text-xs font-bold text-[#00C4D4] shrink-0">{item.note}</span>
                  )}
                </div>
              ))}
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
      </section>

      {/* ── ROI ── */}
      <section className="border-t border-slate-100 dark:border-slate-800/50 py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <FadeUp>
            <div className="border-l-4 border-emerald-500 pl-8 sm:pl-12">
              <p className="text-xs font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-[0.22em] mb-5">En moyenne</p>
              <p className="text-7xl sm:text-8xl lg:text-[9rem] font-black text-slate-900 dark:text-white leading-none tracking-tight mb-4">
                +1 951€
              </p>
              <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-2">de CA net par mois</p>
              <p className="text-sm text-slate-400 dark:text-slate-600">+100€/jour · −49€/mois d'abonnement · 22 jours ouvrés</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="mb-12">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Les formules</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            49€/mois. Sans engagement.
          </h2>
        </FadeUp>
        <FadeGroup className="grid sm:grid-cols-3 gap-6 items-stretch max-w-5xl">
          {PLAN_CARDS.map((card) => {
            const featured = card.key === 'essentiel'
            return (
              <FadeItem
                key={card.key}
                className={`relative flex flex-col rounded-2xl p-6 sm:p-8 ${featured ? 'border border-white/[0.08]' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}
                style={featured ? { background: 'linear-gradient(135deg, #0B1828 0%, #0D2248 100%)' } : undefined}
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  {featured ? (
                    <span className="bg-[#1651E8] text-white text-xs font-bold px-4 py-1.5 rounded-full">Le plus populaire</span>
                  ) : card.comingSoon ? (
                    <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-xs font-bold px-4 py-1.5 rounded-full">Bientôt dispo</span>
                  ) : null}
                </div>
                <p className={`text-base font-bold mt-2 ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{card.name}</p>
                <p className={`text-4xl font-black mt-2 ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {card.price}€<span className={`text-base font-medium ${featured ? 'text-white/45' : 'text-slate-400'}`}>/mois</span>
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
                {card.comingSoon ? (
                  <span className={`block w-full text-center py-3.5 rounded-xl text-sm font-semibold cursor-not-allowed ${featured ? 'bg-white/10 text-white/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                    En développement
                  </span>
                ) : (
                  <Link href="/signup" className="block w-full text-center py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors">
                    Je démarre
                  </Link>
                )}
              </FadeItem>
            )
          })}
        </FadeGroup>
        <FadeUp className="mt-8">
          <p className="text-xs text-slate-400">1 mois offert · Sans carte bancaire · Support WhatsApp — 06 84 14 04 38</p>
        </FadeUp>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp>
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-12">Questions</p>
        </FadeUp>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { q: 'Mes clients doivent créer un compte ?', a: 'Non. Ils réservent directement sur ta page, sans compte, sans appli. Juste leur nom, email et téléphone.' },
            { q: 'C\'est long à configurer ?', a: 'Non. En 10 minutes tu as ta page de réservation avec tes services, tes horaires et ta zone.' },
            { q: 'Que se passe-t-il après le mois gratuit ?', a: 'Tu choisis de continuer à 49€/mois ou non. Ton compte est suspendu sans frais si tu arrêtes. Aucune carte n\'est demandée pendant l\'essai.' },
            { q: 'Ça marche avec une équipe ?', a: 'Oui. Tu configures la taille de ton équipe et les absences. WashBoard adapte la capacité automatiquement.' },
            { q: 'Les clients peuvent payer en ligne ?', a: 'Non, le paiement reste sur place. WashBoard gère la réservation — le règlement, c\'est entre toi et ton client.' },
          ].map((item) => (
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
                Tu laves des voitures.<br />
                <span className="text-[#00C4D4]">On gère le reste.</span>
              </h2>
              <p className="relative text-white/60 text-base mb-10 max-w-sm mx-auto">
                Rejoins les laveurs auto mobiles qui ont optimisé leur tournée avec WashBoard.
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
            WashBoard est le logiciel de gestion dédié aux <strong className="font-medium text-slate-500">laveurs auto mobiles</strong> et aux professionnels du <strong className="font-medium text-slate-500">detailing à domicile</strong>. Réservation en ligne, gestion des rendez-vous, CRM et comptabilité — conçu pour les indépendants du lavage automobile en France.
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
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/LogoWashBoard.png" alt="WashBoard" width={24} height={24} className="rounded-md" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">WashBoard</span>
            </div>
            <p className="text-xs text-slate-400">© 2026 WashBoard · Logiciel lavage auto mobile · Tous droits réservés</p>
            <div className="flex gap-4 text-xs text-slate-400">
              <Link href="/login" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Connexion</Link>
              <Link href="/signup" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Inscription</Link>
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
