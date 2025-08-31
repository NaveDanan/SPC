import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/SPC/', // Replace 'SPC' with your GitHub repository name
  build: {
    outDir: 'dist',
  },
})