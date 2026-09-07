import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function localOrdersSyncPlugin() {
  const filePath = path.resolve(__dirname, '../../.brokole-local-orders.json')

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
                  (o: any) =>
                    o.id === data.order.id ||
                    (data.order.serverId && o.serverId === data.order.serverId) ||
                    (data.order.order_no && o.order_no === data.order.order_no) ||
                    (o.customer_name && data.order.customer_name && o.customer_name.toLowerCase() === data.order.customer_name.toLowerCase())
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

function localPowerBowlSyncPlugin() {
  const filePath = path.resolve(__dirname, '../../.brokole-local-power-bowl.json')

  return {
    name: 'local-power-bowl-sync-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/local-power-bowl-sync', (req: any, res: any) => {
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
              const ingredients = data.ingredients || []
              fs.writeFileSync(filePath, JSON.stringify(ingredients, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, ingredients }))
            } catch (err: any) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: err.message }))
            }
          })
          return
        }

        if (req.method === 'GET') {
          let ingredients: any[] = []
          if (fs.existsSync(filePath)) {
            try {
              ingredients = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            } catch {
              ingredients = []
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, ingredients }))
          return
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localOrdersSyncPlugin(), localPowerBowlSyncPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@brokole/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
    },
  },
  server: { port: 5175, strictPort: true },
})
