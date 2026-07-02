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
      // On mesure la couverture de la LOGIQUE MÉTIER (couche lib), équivalent de
      // ce qu'on teste en unitaire avec JUnit côté service. Les composants React,
      // routes API, PDF, emails et wrappers I/O (Google/Supabase) relèvent de tests
      // d'intégration (autre stack) et sont exclus du calcul pour ne pas fausser le %.
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/email/**',           // envoi d'emails (I/O Resend)
        'src/lib/google-calendar.ts', // I/O Google Calendar
        'src/lib/googleCalendar.ts',  // I/O Google Calendar
        'src/lib/googleReviews.ts',   // scraping HTTP
        'src/lib/supabase/**',        // wrappers client Supabase
        'src/lib/contact.ts',         // utilise window.open (browser uniquement)
      ],
      // Garde-fou anti-régression : si la couverture de la couche métier passe
      // sous ces seuils, `npm run test:coverage` échoue (et donc la CI). On laisse
      // une marge sous le niveau actuel (~99%) pour ne pas bloquer sur du bruit,
      // tout en empêchant une chute franche (ex. nouveau module non testé).
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
})
