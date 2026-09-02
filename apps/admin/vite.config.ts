import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolved by path, not by workspace link, so this app runs standalone
      // (npm install in this folder) as well as inside the pnpm workspace.
      '@brokole/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
    },
  },
  server: { port: 5174 },
})
