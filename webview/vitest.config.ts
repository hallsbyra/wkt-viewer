import { defineConfig } from 'vitest/config'

// Use jsdom so that packages like leaflet that expect a browser global (window, document)
// can be imported in test files without throwing ReferenceError.
export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    globals: true,
    environment: 'jsdom'
  },
})