import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Static, local-only build: no backend, no remote fonts, no API keys.
export default defineConfig({
  plugins: [react()],
  // Pre-bundle the 3D stack up front so the dev server never re-optimises mid-session
  // (that produced duplicate React copies / “Outdated Optimize Dep” during Batch 3).
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'three', '@react-three/fiber', '@react-three/drei'] },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Authoring sources (design/, data/ originals, the reference video) are never copied:
    // only files under public/ and modules imported from src/ enter dist/.
    copyPublicDir: true,
    // three.js + Drei live in the lazily loaded scene chunk (~250 KB gzip); the shell chunk stays small.
    chunkSizeWarningLimit: 1200, // T33 added ~32 kB (12 kB gzip) of shaders and scenery generators
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    restoreMocks: true,
  },
});
