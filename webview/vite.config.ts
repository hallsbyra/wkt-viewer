import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
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
    cors: {
      origin: '*', // Allow all origins (for development only)
      // Alternatively, specify the webview origin:
      // origin: 'vscode-webview://*',
    },
  }
})
