import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],

      // ── Ce que le chiffre de couverture veut dire ────────────────────────
      //
      // Il n'a longtemps porté que sur `src/lib`, et affichait 97 %. Lu vite,
      // ce 97 % laissait croire que l'application était couverte à 97 % : en
      // réalité `src/lib` ne pèse qu'un neuvième du code, et les routes API —
      // là où vivent l'authentification, le cloisonnement entre laveurs et le
      // calcul des prix — n'étaient pas mesurées du tout. Un audit externe l'a
      // relevé le 2026-09-05, à juste titre.
      //
      // La couche API entre donc dans la mesure. Son taux est bas, et c'est le
      // but : mieux vaut un chiffre honnête et gênant qu'un chiffre flatteur.
      // Il ne peut plus que monter, le seuil ci-dessous servant de cliquet.
      //
      // Restent hors mesure, faute d'outillage adapté dans cette configuration
      // (environnement `node`, pas de DOM) : les composants React, les pages,
      // la génération de PDF et les gabarits d'emails. Ils sont couverts par
      // les tests de bout en bout Playwright, dont le résultat ne s'exprime
      // pas en pourcentage de lignes.
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        'src/lib/email/**',           // envoi d'emails (I/O Resend)
        'src/lib/google-calendar.ts', // I/O Google Calendar
        'src/lib/googleCalendar.ts',  // I/O Google Calendar
        'src/lib/googleReviews.ts',   // scraping HTTP
        'src/lib/supabase/**',        // wrappers client Supabase
        'src/lib/contact.ts',         // utilise window.open (browser uniquement)
      ],

      // Un seuil par couche. Les fichiers couverts par un motif sortent du
      // calcul global : les deux familles ne se diluent donc pas l'une dans
      // l'autre, et une régression sur la logique métier ne peut plus être
      // masquée par l'ajout de routes non testées.
      thresholds: {
        // Logique métier : niveau réel ~99 %, marge laissée pour le bruit.
        'src/lib/**/*.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        // Routes API : niveau réel ~12 %. Seuil placé juste en dessous pour
        // qu'il agisse comme un cliquet — à relever à chaque route testée.
        // Couvertes aujourd'hui : création de réservation, profil laveur.
        'src/app/api/**/*.ts': {
          statements: 11,
          branches: 13,
          functions: 6,
          lines: 11,
        },
      },
    },
  },
})
