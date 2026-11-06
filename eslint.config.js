import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Folder boundaries: each layer may only import from the layers listed. See CLAUDE.md. */
const boundary = (forbidden, message) => ({
  "no-restricted-imports": [
    "error",
    { patterns: forbidden.map((group) => ({ group: [group], message })) },
  ],
});

export default tseslint.config(
  {
    ignores: [
      "dist/",
      ".wrangler/",
      "node_modules/",
      "src/server/worker-configuration.d.ts",
      "dev-dist/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["src/domain/**"],
    rules: boundary(
      [
        "@shared/*",
        "**/shared/**",
        "**/server/**",
        "**/client/**",
        "react",
        "drizzle-orm*",
        "dexie*",
        "hono*",
      ],
      "domain/ is pure business logic: no framework, storage, or app imports.",
    ),
  },
  {
    files: ["src/shared/**"],
    rules: boundary(
      ["**/server/**", "**/client/**", "react", "drizzle-orm*", "dexie*", "hono*"],
      "shared/ may only import domain/ and zod.",
    ),
  },
  {
    files: ["src/server/**"],
    rules: boundary(["**/client/**", "react", "dexie*"], "server/ must not import client code."),
  },
  {
    files: ["src/client/**"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...boundary(
        ["**/server/**", "drizzle-orm*", "hono*"],
        "client/ must not import server code.",
      ),
    },
  },
);
