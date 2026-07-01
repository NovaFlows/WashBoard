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
      ],
    },
  },
})
