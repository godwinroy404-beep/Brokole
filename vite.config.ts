import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'
import fs from 'fs'

function localOrdersSyncPlugin() {
  const filePath = path.resolve(__dirname, '.brokole-local-orders.json')

  return {
    name: 'local-orders-sync-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/local-orders-sync', (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: any) => { body += chunk })
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              let current: any[] = []
              if (fs.existsSync(filePath)) {
                try {
                  current = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
                } catch {
                  current = []
                }
              }
              if (data.action === 'save_all') {
                current = data.orders || []
              } else if (data.order) {
                const idx = current.findIndex(
                  (o: any) => o.id === data.order.id || (data.order.serverId && o.serverId === data.order.serverId)
                )
                if (idx >= 0) {
                  current[idx] = { ...current[idx], ...data.order }
                } else {
                  current.unshift(data.order)
                }
              }
              fs.writeFileSync(filePath, JSON.stringify(current, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, orders: current }))
            } catch (err: any) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: err.message }))
            }
          })
          return
        }

        if (req.method === 'GET') {
          let current: any[] = []
          if (fs.existsSync(filePath)) {
            try {
              current = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            } catch {
              current = []
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, orders: current }))
          return
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    localOrdersSyncPlugin(),
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Pinned so the storefront is always 5174 and the admin console 5175.
    port: 5174,
    strictPort: true,
  },
})


