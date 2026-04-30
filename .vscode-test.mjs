import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
    files: 'extension/dist/**/*.test.js',
    extensionDevelopmentPath: '.',
    download: {
        timeout: 60000,
    },
    mocha: {
        timeout: 20000,
    },
})
