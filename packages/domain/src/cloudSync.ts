/**
 * Global Real-Time Cloud Order & Operations Sync (Firebase & Multi-Cloud Relay)
 * 
 * Provides instantaneous, zero-config real-time synchronization across devices,
 * mobile phones, networks, and deployment targets (Vercel & Localhost).
 */

const CLOUD_ORDERS_BIN = 'https://extendsclass.com/api/json-storage/bin/beeadbb';
const CLOUD_POWER_BOWL_BIN = 'https://extendsclass.com/api/json-storage/bin/cbfecea';

export interface CloudOrderPayload {
  id: string;
  order_no?: string;
  serverId?: string;
  userId?: string;
  userEmail?: string;
  customerName?: string;
  customer_name?: string;
  customerPhone?: string;
  customerAddress?: string;
  itemsSummary?: string;
  itemsList?: any[];
  lines?: any[];
  totalAmount?: number;
  total?: number;
  proteinGrams?: number;
  calories?: number;
  status: string;
  createdAt?: string;
  created_at?: string;
  placed_at?: string;
  notes?: string;
  channel?: string;
  deleted?: boolean;
}

let memoryOrdersCache: CloudOrderPayload[] = [];
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('brokole-live-sync-channel');
  }
} catch {}

/**
 * Normalizes an order record into a unified shape.
 */
export function normalizeCloudOrder(o: any): CloudOrderPayload {
  const id = String(o.id || o.order_no || o.serverId || `ORD-${Date.now()}`);
  const itemsSummary = o.itemsSummary || (o.lines ? o.lines.map((l: any) => l.name_snapshot || l.title).join(', ') : 'Healthy Meals');
  const isSubscription =
    o.channel === 'subscription' ||
    id.toLowerCase().includes('sub') ||
    String(o.order_no || '').toLowerCase().includes('sub') ||
    itemsSummary.toLowerCase().includes('plan') ||
    itemsSummary.toLowerCase().includes('subscription') ||
    itemsSummary.toLowerCase().includes('weekly') ||
    itemsSummary.toLowerCase().includes('monthly') ||
    itemsSummary.toLowerCase().includes('shred');

  return {
    id,
    order_no: o.order_no || o.id || id,
    serverId: o.serverId || id,
    userId: o.userId || o.customer_id || '',
    userEmail: o.userEmail || o.email || '',
    customerName: o.customerName || o.customer_name || 'Customer',
    customer_name: o.customer_name || o.customerName || 'Customer',
    customerPhone: o.customerPhone || o.phone || '',
    customerAddress: o.customerAddress || o.address || '',
    itemsSummary,
    itemsList: o.itemsList || o.lines || [],
    lines: o.lines || o.itemsList || [],
    totalAmount: Number(o.totalAmount || o.total || 0),
    total: Number(o.total || o.totalAmount || 0),
    proteinGrams: Number(o.proteinGrams || o.total_protein || 45),
    calories: Number(o.calories || o.total_calories || 520),
    status: o.status || 'placed',
    createdAt: o.createdAt || o.created_at || new Date().toISOString(),
    created_at: o.created_at || o.createdAt || new Date().toISOString(),
    placed_at: o.placed_at || o.createdAt || new Date().toISOString(),
    notes: o.notes || '',
    channel: isSubscription ? 'subscription' : (o.channel || 'direct'),
    skipped_days: o.skipped_days || [],
    deleted: Boolean(o.deleted),
  } as any;
}

/**
 * Fetches all orders from the global cloud sync store with strict cache-busting.
 */
export async function fetchCloudOrders(): Promise<CloudOrderPayload[]> {
  // 1. First attempt to fetch from native serverless / local sync endpoint
  try {
    const res = await fetch(`/api/local-orders-sync?_t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.orders) && data.orders.length > 0) {
        memoryOrdersCache = data.orders.map(normalizeCloudOrder);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(memoryOrdersCache));
          }
        } catch {}
        return memoryOrdersCache;
      }
    }
  } catch {}

  // 2. Secondary attempt to fetch from global cloud bin
  try {
    const url = `${CLOUD_ORDERS_BIN}?_t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (res.ok) {
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      if (Array.isArray(data?.orders) && data.orders.length > 0) {
        memoryOrdersCache = data.orders.map(normalizeCloudOrder);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(memoryOrdersCache));
          }
        } catch {}
        return memoryOrdersCache;
      }
    }
  } catch (err) {
    console.warn('Cloud sync fetch error:', err);
  }

  // 3. Fallback to local cache if offline
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('brokole-cloud-orders-cache');
      if (cached) {
        memoryOrdersCache = JSON.parse(cached);
        return memoryOrdersCache;
      }
    }
  } catch {}

  return memoryOrdersCache;
}

/**
 * Pushes a new order or updates an existing order in the global cloud store.
 */
export async function pushCloudOrder(order: any): Promise<void> {
  const norm = normalizeCloudOrder(order);

  // Optimistic memory update with merging
  const existingIdx = memoryOrdersCache.findIndex(
    (o) => o.id === norm.id || (norm.order_no && o.order_no === norm.order_no)
  );

  if (existingIdx >= 0) {
    memoryOrdersCache[existingIdx] = { ...memoryOrdersCache[existingIdx], ...norm };
  } else {
    memoryOrdersCache.unshift(norm);
  }

  // Local storage cache
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(memoryOrdersCache));
    }
  } catch {}

  // Broadcast to other tabs on same device
  try {
    syncChannel?.postMessage({ type: 'ORDER_UPDATED', order: norm });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bkl-orders-updated', { detail: norm }));
    }
  } catch {}

  // Push to native serverless / local sync endpoint (Vercel & Localhost)
  try {
    await fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: norm }),
    }).catch(() => {});
  } catch {}

  // Push to Global Cloud Store
  try {
    let currentOrders = [...memoryOrdersCache];
    try {
      const freshRes = await fetch(`${CLOUD_ORDERS_BIN}?_t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (freshRes.ok) {
        const text = await freshRes.text();
        const freshData = JSON.parse(text);
        if (Array.isArray(freshData?.orders)) {
          const freshNormalized = freshData.orders.map(normalizeCloudOrder);
          const map = new Map<string, CloudOrderPayload>();
          freshNormalized.forEach((o: CloudOrderPayload) => map.set(o.id, o));
          memoryOrdersCache.forEach((o: CloudOrderPayload) => {
            const ex = map.get(o.id);
            map.set(o.id, ex ? { ...ex, ...o } : o);
          });
          const ex = map.get(norm.id);
          map.set(norm.id, ex ? { ...ex, ...norm } : norm);

          currentOrders = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
        }
      }
    } catch {}

    await fetch(CLOUD_ORDERS_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: currentOrders }),
    });

    memoryOrdersCache = currentOrders;
  } catch (err) {
    console.warn('Cloud sync push error:', err);
  }
}

/**
 * Updates an order status across all devices globally without losing any order data.
 */
export async function updateCloudOrderStatus(orderId: string, newStatus: string): Promise<void> {
  const targetId = String(orderId).toLowerCase();

  // 1. Update memory cache
  let targetFound: CloudOrderPayload | null = null;
  memoryOrdersCache = memoryOrdersCache.map((o) => {
    if (String(o.id).toLowerCase() === targetId || String(o.order_no).toLowerCase() === targetId) {
      targetFound = { ...o, status: newStatus };
      return targetFound;
    }
    return o;
  });

  // 2. Fetch fresh cloud orders and merge
  let cloudOrders: CloudOrderPayload[] = [];
  try {
    const res = await fetch(`${CLOUD_ORDERS_BIN}?_t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.orders)) {
        cloudOrders = data.orders.map(normalizeCloudOrder);
      }
    }
  } catch {}

  const map = new Map<string, CloudOrderPayload>();
  for (const o of cloudOrders) {
    map.set(o.id, o);
  }
  for (const o of memoryOrdersCache) {
    const existing = map.get(o.id);
    map.set(o.id, existing ? { ...existing, ...o } : o);
  }

  // Update target in map
  let matched = false;
  for (const [k, o] of map.entries()) {
    if (String(o.id).toLowerCase() === targetId || String(o.order_no).toLowerCase() === targetId) {
      map.set(k, { ...o, status: newStatus });
      matched = true;
      break;
    }
  }

  if (!matched) {
    map.set(orderId, {
      id: orderId,
      order_no: orderId,
      status: newStatus,
      createdAt: new Date().toISOString(),
    });
  }

  const finalOrders = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  memoryOrdersCache = finalOrders;

  try {
    await fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: newStatus }),
    }).catch(() => {});
  } catch {}

  try {
    await fetch(CLOUD_ORDERS_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: finalOrders }),
    });
  } catch {}

  try {
    syncChannel?.postMessage({ type: 'ORDER_UPDATED', orderId, status: newStatus });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bkl-orders-updated', { detail: { orderId, status: newStatus } }));
    }
  } catch {}
}

/**
 * Deletes or cancels an order globally across memory, local sync, and cloud bin.
 */
export async function deleteCloudOrder(orderId: string): Promise<void> {
  const targetId = String(orderId).toLowerCase();

  // 1. Remove/mark deleted in memory cache
  memoryOrdersCache = memoryOrdersCache.filter(
    (o) => String(o.id).toLowerCase() !== targetId && String(o.order_no).toLowerCase() !== targetId
  );

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(memoryOrdersCache));
    }
  } catch {}

  // 2. Post deletion to local sync endpoint
  try {
    await fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', orderId, order_no: orderId }),
    }).catch(() => {});
  } catch {}

  // 3. Update cloud store
  try {
    let cloudOrders: CloudOrderPayload[] = [];
    const res = await fetch(`${CLOUD_ORDERS_BIN}?_t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.orders)) {
        cloudOrders = data.orders.filter(
          (o: any) => String(o.id).toLowerCase() !== targetId && String(o.order_no).toLowerCase() !== targetId
        );
      }
    }

    await fetch(CLOUD_ORDERS_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: cloudOrders }),
    });
  } catch {}

  // 4. Broadcast deletion event
  try {
    syncChannel?.postMessage({ type: 'ORDER_DELETED', orderId });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bkl-orders-updated', { detail: { orderId, deleted: true } }));
    }
  } catch {}
}

/**
 * Global Power Bowl Customization Sync
 */
export async function fetchCloudPowerBowl(): Promise<any[]> {
  try {
    const res = await fetch(`${CLOUD_POWER_BOWL_BIN}?_t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.ingredients) && data.ingredients.length > 0) {
        return data.ingredients;
      }
    }
  } catch {}

  try {
    const localRes = await fetch('/api/local-power-bowl-sync');
    if (localRes.ok) {
      const data = await localRes.json();
      if (Array.isArray(data?.ingredients) && data.ingredients.length > 0) {
        return data.ingredients;
      }
    }
  } catch {}

  return [];
}

/**
 * Clears all orders in the global cloud store and memory cache (for testing / reset).
 */
export async function clearAllCloudOrders(): Promise<void> {
  memoryOrdersCache = [];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('brokole-cloud-orders-cache');
    }
  } catch {}

  try {
    await fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_all' }),
    }).catch(() => {});
  } catch {}

  try {
    await fetch(CLOUD_ORDERS_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: [] }),
    });
  } catch {}

  try {
    fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_all', orders: [] }),
    }).catch(() => {});
  } catch {}

  try {
    syncChannel?.postMessage({ type: 'ORDERS_CLEARED' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bkl-orders-updated'));
    }
  } catch {}
}

export async function pushCloudPowerBowl(ingredients: any[]): Promise<void> {
  try {
    await fetch(CLOUD_POWER_BOWL_BIN, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients }),
    });
  } catch {}

  try {
    fetch('/api/local-power-bowl-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients }),
    }).catch(() => {});
  } catch {}
}
