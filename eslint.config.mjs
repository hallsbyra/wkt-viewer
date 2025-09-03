// @ts-check

import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            // Everything JS
            '**/*.js', '**/*.cjs', '**/*.mjs',
            // Build artifacts
            '**/dist/**',
            '**/.vscode-test/**',
            '**/node_modules/**',
        ],
    },
    // Make @stylistic rules available
    {
        plugins: {
            '@stylistic': stylistic
        },
    },
    // Bring in TS defaults
    ...tseslint.configs.recommended,
    // Override rules
    {
        rules: {
            '@stylistic/member-delimiter-style': ['error', {
                'multiline': {
                    'delimiter': 'none',      // <- stop eslint inserting `;`
                    'requireLast': false      // <- and don’t demand a final delim.
                },
                'singleline': {
                    'delimiter': 'comma',     // keeps `foo: string, bar: number`
                    'requireLast': false
                }
            }],
            '@stylistic/quotes': ['error', 'single', {
                allowTemplateLiterals: 'always',
            }],
            '@stylistic/semi': ['error', 'never'],
            // Allow unused variables prefixed with `_`
            "@typescript-eslint/no-unused-vars": ['error', { 'argsIgnorePattern': '^_' }],
        }
    },
)
