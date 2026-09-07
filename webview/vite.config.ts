import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // VS Code webviews run Vite in a sandboxed iframe. Disable HMR so the React
  // plugin does not inject its Fast Refresh signature runtime into the iframe.
  plugins: [react()],
  base: './', // Make all assets relative to the current directory.
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
  server: {
    port: 3000,
    hmr: false,
    cors: {
      origin: '*', // Allow all origins (for development only)
      // Alternatively, specify the webview origin:
      // origin: 'vscode-webview://*',
    },
  }
})
