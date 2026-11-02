import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset URLs relative so the build works from any
// GitHub Pages project path (e.g. https://user.github.io/homeops/).
// HashRouter means no server-side rewrite rules are needed.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
