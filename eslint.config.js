import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/** Math functions whose results can differ between engines, plus `random`. The core is integers only. */
const NON_DETERMINISTIC_MATH = [
  "random",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "exp",
  "expm1",
  "log",
  "log1p",
  "log2",
  "log10",
  "pow",
  "hypot",
  "cbrt",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
];

/** Clocks, timers, the DOM, storage and the network: none of them belong in a pure `step`. */
const CORE_BANNED_GLOBALS = [
  "Date",
  "performance",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "queueMicrotask",
  "window",
  "self",
  "globalThis",
  "document",
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "Worker",
  "crypto",
  "process",
].map((name) => ({
  name,
  message: "Not allowed in src/core: the simulation is pure (CLAUDE.md, code conventions).",
}));

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "playwright-report",
      "test-results",
      "node_modules",
      ".wrangler",
      "design-captures",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // The simulation must give bit-identical results in every browser and in Node (CLAUDE.md).
    files: ["src/core/**/*.ts"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-properties": [
        "error",
        ...NON_DETERMINISTIC_MATH.map((property) => ({
          object: "Math",
          property,
          message:
            "Not deterministic across engines (or random). Use src/core/rng.ts and integers.",
        })),
      ],
      "no-restricted-globals": ["error", ...CORE_BANNED_GLOBALS],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: "Time comes in as ticks in src/core.",
        },
      ],
    },
  },
);
