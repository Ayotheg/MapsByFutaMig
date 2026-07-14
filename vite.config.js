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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor_react';
            }
            if (id.includes('@supabase')) {
              return 'vendor_supabase';
            }
            if (id.includes('leaflet')) {
              return 'vendor_leaflet';
            }
            return 'vendor'; // generic vendor chunk
          }
        }
      }
    }
  }
})
