import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default [
    // Base JavaScript config
    js.configs.recommended,

    // Base TypeScript config
    ...tseslint.configs.recommended,

    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tseslint.parser,
        },
        rules: {
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
        }
    },
    {
        files: ["**/*.js"],
        rules: {
            // Lots of warnings about window, $, and document not existing.
            'no-undef': ["off"],
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
        }
    }
]