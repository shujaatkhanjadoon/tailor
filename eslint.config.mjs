import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
    {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react/no-unescaped-entities": "warn",

    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "public/workbox-*.js",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
