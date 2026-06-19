'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

function FadeUp({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay }}
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </motion.div>
  )
}

function FadeGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
    >
      {children}
    </motion.div>
  )
}

function FadeItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
    >
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
      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label="Changer de thème"
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans transition-colors duration-300 overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={36} height={36} className="rounded-lg shrink-0 sm:w-12 sm:h-12" />
            <span className="text-lg sm:text-2xl font-extrabold tracking-tight truncate">WashBoard</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle />
            <Link href="/login" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hidden sm:block px-3 py-2">
              Connexion
            </Link>
            <Link href="/signup" className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
              <span className="sm:hidden">Essayer</span>
              <span className="hidden sm:inline">Essayer gratuitement</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-20 text-center">
        <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}>
          <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-medium text-blue-600 dark:text-blue-400 mb-8">
            <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full" />
            Logiciel de gestion pour laveurs auto mobiles & detailing
          </motion.div>
          <motion.h1 variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6 text-slate-900 dark:text-white">
            Le logiciel des laveurs auto mobiles qui veulent{' '}
            <span className="text-blue-600 dark:text-blue-500">gagner plus</span>{' '}
            sur le même trajet.
          </motion.h1>
          <motion.p variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }} className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            WashBoard est le logiciel tout-en-un pour les laveurs auto mobiles et prestataires de detailing à domicile.
            Réservation en ligne, gestion des clients, agenda et comptabilité — tout au même endroit.
          </motion.p>
          <motion.div variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20">
              Commencer gratuitement — 1 mois
            </Link>
            <Link href="/login" className="w-full sm:w-auto px-8 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-base font-semibold rounded-xl transition-colors border border-slate-200 dark:border-slate-700">
              J&apos;ai déjà un compte
            </Link>
          </motion.div>
          <motion.p variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }} className="text-xs text-slate-400 mt-4">Sans engagement · Sans carte bancaire</motion.p>
        </motion.div>

        {/* Dashboard mockup */}
        <FadeUp className="mt-16" delay={0.2}>
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-950 via-transparent to-transparent z-10 pointer-events-none" style={{ top: '55%' }} />
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/80 dark:shadow-slate-950/80">
              <div className="bg-slate-100 dark:bg-slate-800/60 px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                  <div className="w-3 h-3 rounded-full bg-green-400/70" />
                </div>
                <div className="flex-1 bg-slate-200 dark:bg-slate-700/50 rounded-md px-3 py-1 text-xs text-slate-500 text-center max-w-xs mx-auto">
                  wash-board.vercel.app/dashboard
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'CA ce mois', value: '4 200€', up: true },
                  { label: 'Réservations', value: '38', up: true },
                  { label: 'En attente', value: '5', up: false },
                  { label: 'Créneaux optimisés', value: '12', up: true },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    <p className={`text-xs mt-1 font-medium ${stat.up ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {stat.up ? '↑ +12% ce mois' : '→ À confirmer'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Prochains RDV</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full font-medium">3 créneaux optimisés</span>
                  </div>
                  {[
                    { time: '09:00', name: 'Martin Dupont', service: 'Lavage extérieur', smart: false },
                    { time: '10:00', name: 'Sophie Bernard', service: 'Lavage complet', smart: true },
                    { time: '11:30', name: 'Garage Lefebvre', service: 'Pack entreprise × 4', smart: false },
                  ].map((rdv) => (
                    <div key={rdv.time} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                      <span className="text-sm font-bold text-slate-500 dark:text-slate-400 w-12 shrink-0">{rdv.time}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{rdv.name}</p>
                        <p className="text-xs text-slate-400 truncate">{rdv.service}</p>
                      </div>
                      {rdv.smart && (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-full shrink-0">
                          ★ Optimisé
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── Pain points ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <FadeUp>
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-12">Tu te reconnais là-dedans ?</p>
        </FadeUp>
        <FadeGroup className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
              title: 'Tu gères les réservations sur WhatsApp',
              desc: 'Messages le soir, relances, confirmations manuelles… Tu passes autant de temps à gérer qu\'à laver.',
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />,
              title: 'Tes trajets ne sont pas optimisés',
              desc: '2 clients à 10 km d\'écart, une heure de route. Chaque trajet non rentabilisé, c\'est du CA jeté par la fenêtre.',
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
              title: 'Tu ne sais pas combien tu gagnes',
              desc: 'Pas de tableau de bord, pas de vision sur ton CA. Tu gères au feeling, pas aux chiffres.',
            },
          ].map((pain) => (
            <FadeItem key={pain.title} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-center text-red-500 dark:text-red-400 mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>{pain.icon}</svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{pain.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{pain.desc}</p>
            </FadeItem>
          ))}
        </FadeGroup>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
            Tout ce dont tu as besoin,{' '}
            <span className="text-blue-600 dark:text-blue-500">rien de superflu</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
            Conçu pour les laveurs mobiles — pas pour des comptables.
          </p>
        </FadeUp>

        {/* Feature phare */}
        <FadeUp className="mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-900 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-5 sm:p-8 grid sm:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div>
              <span className="inline-block text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
                Fonctionnalité phare
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-3">Créneaux optimisés par zone</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-4 text-sm sm:text-base">
                Quand un client réserve dans un quartier où tu interviens déjà, WashBoard propose
                automatiquement un créneau à tarif réduit aux clients proches.
                Tu fais un lavage de plus sans faire un km de plus.
              </p>
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                +2 lavages/jour en moyenne
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 sm:p-4 space-y-2 shadow-sm overflow-hidden">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 truncate">Créneaux du jour — Bordeaux Sud</p>
              {[
                { time: '09:00', label: 'Martin D. — Lavage extérieur', type: 'normal' },
                { time: '10:00', label: 'Sophie B. — Lavage complet', type: 'smart', note: '★ -8€ zone opt.' },
                { time: '10:45', label: 'Paul R. — Lavage extérieur', type: 'smart', note: '★ -5€ zone opt.' },
                { time: '14:00', label: 'Lucie M. — Pack famille', type: 'normal' },
              ].map((item) => (
                <div key={item.time} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg min-w-0 ${item.type === 'smart' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
                  <span className="text-xs font-bold text-slate-400 shrink-0">{item.time}</span>
                  <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 truncate min-w-0">{item.label}</span>
                  {item.type === 'smart' && (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0 whitespace-nowrap">{item.note}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeUp>

        <FadeGroup className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
              title: 'Page de réservation en ligne',
              desc: 'Chaque laveur a sa propre page publique. Tes clients réservent eux-mêmes, 24h/24, sans créer de compte. Fini les allers-retours WhatsApp.',
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
              title: 'Tableau de bord complet',
              desc: 'CA, réservations, clients pros et particuliers, export comptable. Tu pilotes ton activité en 2 minutes le matin depuis ton téléphone.',
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
              title: 'Accompagnement gratuit',
              desc: 'On te guide pas à pas pour la mise en place. Une question ? Notre service client répond sur WhatsApp au 06 84 14 04 38 — compris dans l\'abonnement, sans supplément.',
            },
          ].map((feat) => (
            <FadeItem key={feat.title} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>{feat.icon}</svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feat.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feat.desc}</p>
            </FadeItem>
          ))}
        </FadeGroup>
      </section>

      {/* ── ROI ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
            L&apos;abonnement se rembourse avec{' '}
            <span className="text-blue-600 dark:text-blue-500">1 lavage de plus par semaine</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
            Le calcul est simple. WashBoard ne coûte pas 49€ — il en rapporte bien plus.
          </p>
        </FadeUp>
        <FadeGroup className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <FadeItem className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Sans WashBoard</p>
            <div className="space-y-3">
              {[
                { label: 'Lavages par jour', value: '6' },
                { label: 'CA journalier', value: '300€' },
                { label: 'Gestion des RDV', value: 'WhatsApp manuel' },
                { label: 'Trajets optimisés', value: 'Non' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{row.label}</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{row.value}</span>
                </div>
              ))}
            </div>
          </FadeItem>
          <FadeItem className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-900 border-2 border-blue-300 dark:border-blue-700/40 rounded-2xl p-6">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4">Avec WashBoard</p>
            <div className="space-y-3">
              {[
                { label: 'Lavages par jour', value: '8' },
                { label: 'CA journalier', value: '400€' },
                { label: 'Gestion des RDV', value: 'Automatique' },
                { label: 'Trajets optimisés', value: 'Oui' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-blue-100 dark:border-blue-900/30">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{row.label}</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{row.value}</span>
                </div>
              ))}
            </div>
          </FadeItem>
        </FadeGroup>
        <FadeUp className="text-center mt-8">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            +100€/jour · -49€/mois = <span className="text-slate-900 dark:text-white font-bold text-base">+1 951€ de CA net par mois</span>
          </p>
        </FadeUp>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">Un seul tarif. Tout inclus.</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">Pas de frais cachés, pas de paliers compliqués.</p>
        </FadeUp>
        <FadeUp className="max-w-sm mx-auto">
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 dark:border-blue-600 rounded-2xl p-8 text-center relative shadow-xl shadow-blue-100 dark:shadow-blue-950/30">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">Le plus populaire</span>
            </div>
            <p className="text-5xl font-extrabold text-slate-900 dark:text-white mt-2">49€<span className="text-xl font-medium text-slate-400">/mois</span></p>
            <p className="text-slate-400 text-sm mt-1 mb-6">Sans engagement · Résiliable à tout moment</p>
            <div className="space-y-3 text-left mb-8">
              {[
                'Page de réservation personnalisée',
                'Créneaux optimisés par zone',
                'Calendrier & gestion des RDV',
                'CRM clients (pros + particuliers)',
                'Export PDF & Excel',
                'Confirmation email automatique',
                'Connexion Google Calendar',
                'Accompagnement à la mise en place',
                'Support WhatsApp gratuit — 06 84 14 04 38',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feat}
                </div>
              ))}
            </div>
            <Link href="/signup" className="block w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-base">
              Commencer gratuitement — 1 mois
            </Link>
            <p className="text-xs text-slate-400 mt-3">Sans carte bancaire pour l&apos;essai</p>
          </div>
        </FadeUp>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp>
          <h2 className="text-2xl font-extrabold text-center tracking-tight mb-10 text-slate-900 dark:text-white">Questions fréquentes</h2>
        </FadeUp>
        <FadeGroup className="space-y-4">
          {[
            { q: 'Mes clients doivent-ils créer un compte ?', a: 'Non. Tes clients réservent directement sur ta page sans créer de compte ni télécharger d\'appli. Juste leur nom, email et téléphone.' },
            { q: 'Est-ce difficile à configurer ?', a: 'Non. En 10 minutes tu as ta page de réservation en ligne avec tes services, tes horaires et ta zone d\'intervention.' },
            { q: 'Que se passe-t-il après le mois d\'essai ?', a: 'Tu choisis si tu veux continuer à 49€/mois. Si non, ton compte est suspendu sans frais. Aucune carte bancaire n\'est demandée pendant l\'essai.' },
            { q: 'Ça fonctionne si j\'ai une équipe ?', a: 'Oui. Tu configures la taille de ton équipe et gères les absences partielles. WashBoard adapte automatiquement la capacité de réservation.' },
            { q: 'Les clients peuvent-ils payer en ligne ?', a: 'Non, le paiement se fait sur place. WashBoard gère la réservation et la confirmation — le règlement reste entre toi et ton client.' },
          ].map((item) => (
            <FadeItem key={item.q} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-base font-semibold text-slate-900 dark:text-white mb-2">{item.q}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.a}</p>
            </FadeItem>
          ))}
        </FadeGroup>
      </section>

      {/* ── CTA final ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-slate-100 dark:border-slate-800/50">
        <FadeUp>
          <div className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-950/60 dark:to-slate-900 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-10 sm:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
              Tu laves des voitures.
              <br />
              <span className="text-blue-600 dark:text-blue-500">On gère le reste.</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg mb-8 max-w-lg mx-auto">
              Rejoins les laveurs auto mobiles qui ont optimisé leur tournée avec WashBoard.
            </p>
            <Link href="/signup" className="inline-block px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20">
              Essayer gratuitement — 1 mois
            </Link>
            <p className="text-xs text-slate-400 mt-4">Sans engagement · Sans carte bancaire</p>
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 text-center">
          <p className="text-xs text-slate-400 leading-relaxed">
            WashBoard est le logiciel de gestion dédié aux <strong className="font-medium text-slate-500">laveurs auto mobiles</strong> et aux professionnels du <strong className="font-medium text-slate-500">detailing à domicile</strong>. Page de réservation en ligne, gestion des rendez-vous, CRM clients et comptabilité — conçu pour les indépendants du lavage automobile en France.
          </p>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={24} height={24} className="rounded-md" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">WashBoard</span>
          </div>
          <p className="text-xs text-slate-400">© 2026 WashBoard · Logiciel lavage auto mobile · Tous droits réservés</p>
          <div className="flex gap-4 text-xs text-slate-400">
            <Link href="/login" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Connexion</Link>
            <Link href="/signup" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Inscription</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
