import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">WashBoard</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
              Connexion
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-950 border border-blue-800 rounded-full text-xs font-medium text-blue-400 mb-8">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
          Conçu exclusivement pour les laveurs auto mobiles
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
          Remplis tes créneaux vides.{' '}
          <span className="text-blue-500">Gagne plus</span>{' '}
          sur le même trajet.
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          WashBoard regroupe automatiquement tes réservations par zone et optimise ta journée —
          pour que chaque kilomètre compte.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-bold rounded-xl transition-colors shadow-lg shadow-blue-900/40">
            Commencer gratuitement — 14 jours
          </Link>
          <Link href="/login" className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white text-base font-semibold rounded-xl transition-colors border border-slate-700">
            J&apos;ai déjà un compte
          </Link>
        </div>
        <p className="text-xs text-slate-500 mt-4">Sans engagement · Sans carte bancaire</p>

        {/* Dashboard mockup */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" style={{ top: '60%' }} />
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-slate-950/80 mx-auto max-w-4xl">
            <div className="bg-slate-800/60 px-4 py-3 flex items-center gap-2 border-b border-slate-700/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 bg-slate-700/50 rounded-md px-3 py-1 text-xs text-slate-500 text-center max-w-xs mx-auto">
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
                <div key={stat.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className={`text-xs mt-1 font-medium ${stat.up ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {stat.up ? '↑ +12% ce mois' : '→ À confirmer'}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">Prochains RDV</span>
                  <span className="text-xs text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-full font-medium">3 créneaux optimisés aujourd&apos;hui</span>
                </div>
                {[
                  { time: '09:00', name: 'Martin Dupont', service: 'Lavage extérieur', zone: 'Bordeaux Sud', smart: false },
                  { time: '10:00', name: 'Sophie Bernard', service: 'Lavage complet', zone: 'Bordeaux Sud', smart: true },
                  { time: '11:30', name: 'Kooki Clean Pro', service: 'Pack entreprise × 4', zone: 'Bordeaux Centre', smart: false },
                ].map((rdv) => (
                  <div key={rdv.time} className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/30 last:border-0">
                    <span className="text-sm font-bold text-slate-300 w-12 shrink-0">{rdv.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{rdv.name}</p>
                      <p className="text-xs text-slate-400 truncate">{rdv.service} · {rdv.zone}</p>
                    </div>
                    {rdv.smart && (
                      <span className="text-xs font-bold text-amber-400 bg-amber-900/30 border border-amber-800/50 px-2 py-0.5 rounded-full shrink-0">
                        ★ Optimisé
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest mb-12">
          Tu te reconnais là-dedans ?
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ),
              title: 'Tu gères les réservations sur WhatsApp',
              desc: 'Messages le soir, relances, confirmations manuelles... Tu passes autant de temps à gérer qu\'à laver.',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              ),
              title: 'Tes trajets ne sont pas optimisés',
              desc: '2 clients à 10 km d\'écart, une heure de route. Chaque km non optimisé, c\'est du temps et de l\'essence perdus.',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              title: 'Tu ne sais pas combien tu gagnes',
              desc: 'Pas de tableau de bord, pas de vision sur ton CA. Tu gères au feeling, pas aux chiffres.',
            },
          ].map((pain) => (
            <div key={pain.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="w-10 h-10 bg-red-950/60 border border-red-900/50 rounded-xl flex items-center justify-center text-red-400 mb-4">
                {pain.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-2">{pain.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{pain.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-800/50">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Tout ce dont tu as besoin,{' '}
            <span className="text-blue-500">rien de superflu</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            WashBoard est conçu pour les laveurs mobiles — pas pour des comptables ou des développeurs.
          </p>
        </div>
        <div className="space-y-6">

          {/* Feature principale — créneaux intelligents */}
          <div className="bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/40 rounded-2xl p-8 grid sm:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block text-xs font-bold text-blue-400 bg-blue-950 border border-blue-800 px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
                Fonctionnalité phare
              </span>
              <h3 className="text-2xl font-extrabold text-white mb-3">Créneaux optimisés par zone</h3>
              <p className="text-slate-400 leading-relaxed mb-4">
                Quand un client réserve dans un quartier où tu interviens déjà, WashBoard propose automatiquement
                un créneau à tarif réduit aux clients proches. Tu fais un lavage de plus sans faire un km de plus.
              </p>
              <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                +2 lavages/jour en moyenne pour nos utilisateurs
              </div>
            </div>
            <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Créneaux du jour — Bordeaux Sud</p>
              {[
                { time: '09:00', label: 'Martin D. — Lavage extérieur', type: 'normal' },
                { time: '10:00', label: 'Sophie B. — Lavage complet', type: 'smart', note: '-8€ · zone optimisée' },
                { time: '10:45', label: 'Paul R. — Lavage extérieur', type: 'smart', note: '-5€ · zone optimisée' },
                { time: '14:00', label: 'Lucie M. — Pack famille', type: 'normal' },
              ].map((item) => (
                <div key={item.time} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${item.type === 'smart' ? 'bg-amber-900/20 border border-amber-800/40' : 'bg-slate-800/60'}`}>
                  <span className="text-xs font-bold text-slate-400 w-10 shrink-0">{item.time}</span>
                  <span className="text-sm text-slate-200 flex-1 truncate">{item.label}</span>
                  {item.type === 'smart' && (
                    <span className="text-xs font-bold text-amber-400 shrink-0">★ {item.note}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 2 features secondaires */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="w-10 h-10 bg-blue-950/60 border border-blue-900/50 rounded-xl flex items-center justify-center text-blue-400 mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Page de réservation en ligne</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Chaque laveur a sa propre page publique. Tes clients réservent eux-mêmes, 24h/24, sans créer de compte.
                Fini les allers-retours WhatsApp.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="w-10 h-10 bg-blue-950/60 border border-blue-900/50 rounded-xl flex items-center justify-center text-blue-400 mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Tableau de bord complet</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                CA, réservations, clients pros et particuliers, export comptable. Tu pilotes ton activité
                en 2 minutes le matin depuis ton téléphone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROI ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-800/50">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            L&apos;abonnement se rembourse avec{' '}
            <span className="text-blue-500">1 lavage de plus par semaine</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Le calcul est simple. WashBoard ne coûte pas 49€ — il en rapporte bien plus.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Sans WashBoard</p>
            <div className="space-y-3">
              {[
                { label: 'Lavages par jour', value: '6' },
                { label: 'CA journalier moyen', value: '300€' },
                { label: 'Gestion des RDV', value: 'WhatsApp manuel' },
                { label: 'Trajets optimisés', value: 'Non' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-400">{row.label}</span>
                  <span className="text-sm font-semibold text-slate-300">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-700/40 rounded-2xl p-6">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Avec WashBoard</p>
            <div className="space-y-3">
              {[
                { label: 'Lavages par jour', value: '8', up: true },
                { label: 'CA journalier moyen', value: '400€', up: true },
                { label: 'Gestion des RDV', value: 'Automatique', up: true },
                { label: 'Trajets optimisés', value: 'Oui', up: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-blue-900/30">
                  <span className="text-sm text-slate-400">{row.label}</span>
                  <span className="text-sm font-bold text-emerald-400">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-slate-500 text-sm mt-8">
          +100€/jour · -49€/mois d&apos;abonnement = <span className="text-white font-bold">+1 951€ de CA net par mois</span>
        </p>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-800/50">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Un seul tarif. Tout inclus.</h2>
          <p className="text-slate-400 text-lg">Pas de frais cachés, pas de paliers compliqués.</p>
        </div>
        <div className="max-w-sm mx-auto">
          <div className="bg-slate-900 border-2 border-blue-600 rounded-2xl p-8 text-center relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">Le plus populaire</span>
            </div>
            <p className="text-4xl font-extrabold text-white mt-2">49€<span className="text-lg font-medium text-slate-400">/mois</span></p>
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
                'Support inclus',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3 text-sm text-slate-300">
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feat}
                </div>
              ))}
            </div>
            <Link href="/signup" className="block w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-base">
              Commencer gratuitement — 14 jours
            </Link>
            <p className="text-xs text-slate-500 mt-3">Sans carte bancaire pour l&apos;essai</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 py-20 border-t border-slate-800/50">
        <h2 className="text-2xl font-extrabold text-center tracking-tight mb-10">Questions fréquentes</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Mes clients doivent-ils créer un compte ?',
              a: 'Non. Tes clients réservent directement sur ta page sans créer de compte ni télécharger d\'appli. Juste leur nom, email et téléphone.',
            },
            {
              q: 'Est-ce difficile à configurer ?',
              a: 'Non. En 10 minutes tu as ta page de réservation en ligne avec tes services, tes horaires et ta zone d\'intervention. On t\'accompagne à la configuration.',
            },
            {
              q: 'Que se passe-t-il après les 14 jours d\'essai ?',
              a: 'Tu choisis si tu veux continuer à 49€/mois. Si non, ton compte est suspendu sans frais. Aucune carte bancaire n\'est demandée pendant l\'essai.',
            },
            {
              q: 'Ça fonctionne si j\'ai une équipe de plusieurs laveurs ?',
              a: 'Oui. Tu peux configurer la taille de ton équipe et gérer les absences partielles. WashBoard adapte automatiquement la capacité de réservation.',
            },
            {
              q: 'Les clients peuvent-ils payer en ligne ?',
              a: 'Non, le paiement se fait sur place. WashBoard gère la prise de réservation et la confirmation — le règlement reste entre toi et ton client.',
            },
          ].map((item) => (
            <div key={item.q} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-base font-semibold text-white mb-2">{item.q}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-800/50">
        <div className="bg-gradient-to-br from-blue-950/60 to-slate-900 border border-blue-800/40 rounded-2xl p-10 sm:p-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Tu laves des voitures.
            <br />
            <span className="text-blue-500">On gère le reste.</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-lg mx-auto">
            Rejoins les laveurs auto mobiles qui ont optimisé leur tournée avec WashBoard.
          </p>
          <Link href="/signup" className="inline-block px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-bold rounded-xl transition-colors shadow-lg shadow-blue-900/40">
            Essayer gratuitement — 14 jours
          </Link>
          <p className="text-xs text-slate-500 mt-4">Sans engagement · Sans carte bancaire</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-300">WashBoard</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 WashBoard · Tous droits réservés</p>
          <div className="flex gap-4 text-xs text-slate-500">
            <Link href="/login" className="hover:text-slate-300 transition-colors">Connexion</Link>
            <Link href="/signup" className="hover:text-slate-300 transition-colors">Inscription</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
