// Vercel Serverless Function: Real-Time Order Sync Relay
let globalOrders = [];

export default function handler(req, res) {
  // Set full CORS headers for all origins and browsers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ orders: globalOrders });
    return;
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

      if (data.action === 'save_all') {
        globalOrders = Array.isArray(data.orders) ? data.orders : [];
      } else if (data.action === 'clear_all') {
        globalOrders = [];
      } else if (data.action === 'delete' || data.action === 'cancel' || data.deleted) {
        const targetId = String(data.orderId || data.order_no || data.id || '').toLowerCase();
        if (targetId) {
          globalOrders = globalOrders.filter(
            (ex) =>
              String(ex.id || ex.order_no || ex.serverId || '').toLowerCase() !== targetId &&
              String(ex.order_no || '').toLowerCase() !== targetId
          );
        }
      } else if (data.order) {
        const o = data.order;
        if (o.deleted || String(o.status || '').toLowerCase() === 'cancelled') {
          const targetId = String(o.id || o.order_no || o.serverId || '').toLowerCase();
          globalOrders = globalOrders.filter(
            (ex) =>
              String(ex.id || ex.order_no || ex.serverId || '').toLowerCase() !== targetId &&
              String(ex.order_no || '').toLowerCase() !== targetId
          );
        } else {
          const oId = String(o.id || o.order_no || o.serverId || '').toLowerCase();
          const existingIdx = globalOrders.findIndex(
            (ex) => String(ex.id || ex.order_no || ex.serverId || '').toLowerCase() === oId
          );
          if (existingIdx >= 0) {
            globalOrders[existingIdx] = { ...globalOrders[existingIdx], ...o };
          } else {
            globalOrders.unshift(o);
          }
        }
      } else if (data.orderId && data.status) {
        const targetId = String(data.orderId).toLowerCase();
        let matched = false;
        globalOrders = globalOrders.map((ex) => {
          if (String(ex.id || ex.order_no || ex.serverId || '').toLowerCase() === targetId) {
            matched = true;
            return { ...ex, status: data.status };
          }
          return ex;
        });
        if (!matched) {
          globalOrders.unshift({
            id: data.orderId,
            order_no: data.orderId,
            status: data.status,
            createdAt: new Date().toISOString(),
          });
        }
      }

      res.status(200).json({ ok: true, ordersCount: globalOrders.length, orders: globalOrders });
    } catch (err) {
      res.status(400).json({ error: 'Invalid request body', details: String(err) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
