import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
    // Vite 8 uses Rolldown — use rolldownOptions instead of rollupOptions
    rolldownOptions: {
      output: {
        // Rolldown's codeSplitting splits vendor deps automatically
        // by entry points; React.lazy() in routes handles app code splitting
      }
    }
  }
})
