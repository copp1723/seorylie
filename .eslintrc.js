module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  ignorePatterns: [
    "dist",
    ".eslintrc.js",
    "node_modules",
    "*.config.js",
    "packages/*/dist/**",
    "*.d.ts",
    "client/src/**/*.tsx",
    "client/src/**/*.ts",
    "packages/**/*.ts",
    "server/**/*.ts",
    "scripts/**/*.ts",
    "test/**/*.ts",
    "types/**/*.ts",
    "tools/**/*.ts",
    "validation/**/*.ts",
    "database/**/*.ts",
    "monitoring/**/*.ts",
    "cypress/**/*.ts",
    "config/**/*.ts",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["scripts/**/*.js", "examples/**/*.js", "tools/**/*.js"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
