import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
    files: 'extension/dist/**/*.test.js',
    extensionDevelopmentPath: '.',
    mocha: {
        timeout: 20000,
    },
})
