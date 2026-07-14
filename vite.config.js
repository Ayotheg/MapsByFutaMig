import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800, // Increase limit slightly
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code into separate chunks
          vendor_react: ['react', 'react-dom', 'react-router-dom'],
          vendor_supabase: ['@supabase/supabase-js'],
          vendor_leaflet: ['leaflet'],
        }
      }
    }
  }
})
