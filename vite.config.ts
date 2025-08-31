import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use a relative base so assets are referenced relatively in the built `dist/`.
  // This helps assets (images, scripts, css) load correctly when served from
  // GitHub Pages under a subpath or a custom domain.
  base: './',
  build: {
    outDir: 'dist',
  },
})