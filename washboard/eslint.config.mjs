import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rapports générés : les linter produit des avertissements sur du code
    // qu'on n'écrit pas et qu'on ne peut pas corriger.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Outil local de traduction (CommonJS, hors du périmètre React) : sans ça, ESLint plante sur
    // le fichier .cjs, que la config Next ne couvre pas, et le build Vercel échoue.
    "scripts/i18n/**",
  ]),
  {
    rules: {
      // Décision assumée : patterns fetch-on-mount / sync DOM légitimes.
      // Conservé en avertissement (visible) sans bloquer le build / la CI.
      "react-hooks/set-state-in-effect": "warn",
      // Règle du routeur « pages » : avec les adresses inconnues servies par une page attrape-tout
      // (app/(app)/[...introuvable]), elle prend chaque lien interne pour une page et signale les <a>
      // voulus (OAuth Google, rechargements complets). Next/Link reste la norme, revue à la main.
      "@next/next/no-html-link-for-pages": "off",
      // Le préfixe `_` marque une valeur écartée exprès (déstructuration, paramètre d'API).
      "@typescript-eslint/no-unused-vars": ["warn", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
