import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Firebase Hosting serves from root. Set DEPLOY_TARGET=gh-pages to build for GitHub Pages.
  base: process.env.DEPLOY_TARGET === 'gh-pages' ? '/autopilot-discovery-crm/' : '/',
})
