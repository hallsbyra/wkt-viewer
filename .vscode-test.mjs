import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
	files: 'extension/dist/test/**/*.test.js',
})
