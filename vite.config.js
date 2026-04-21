import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Firebase Hosting serves from root. Set DEPLOY_TARGET=gh-pages to build for GitHub Pages.
  base: process.env.DEPLOY_TARGET === 'gh-pages' ? '/autopilot-discovery-crm/' : '/',
  build: {
    // Manual chunking — heavy third-party libs split into long-lived vendor
    // chunks so a code change in our app doesn't bust their cache. Pages are
    // already split per-route via React.lazy in App.jsx.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/functions',
          ],
          'charts-vendor': ['recharts'],
          'markdown-vendor': ['react-markdown', 'remark-gfm'],
          'dnd-vendor': ['@dnd-kit/core'],
        },
      },
    },
    // Tightened from Vite's 500 KB default — alerts us if any single chunk
    // grows past 300 KB. The current vendors comfortably fit.
    chunkSizeWarningLimit: 300,
  },
})
