// eslint.config.mjs
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
            './.vscode-test/**',
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
                allowTemplateLiterals: true,
            }],
            '@stylistic/semi': ['error', 'never'],
            // Allow unused variables prefixed with `_`
            "@typescript-eslint/no-unused-vars": ['error', { 'argsIgnorePattern': '^_' }],
        }
    },
    // // Relax rules for legacy code. We can turn these on as we proceed with the migration.
    // {
    //     files: ['frontend/src/legacy/**/*.ts'],
    //     rules: {
    //         '@stylistic/quotes': 'off',
    //         '@stylistic/semi': 'off',
    //         '@typescript-eslint/no-explicit-any': 'off',
    //         '@typescript-eslint/no-unused-vars': 'off',
    //         'no-var': 'off',
    //         'prefer-const': 'off',
    //     },
    // },
)
