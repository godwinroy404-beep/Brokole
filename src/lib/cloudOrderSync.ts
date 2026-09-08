/**
 * Global Real-Time Cloud Order & Operations Sync
 * 
 * Provides instantaneous, zero-config synchronization across devices,
 * networks, and deployment targets (Vercel Production & Local Development).
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
let lastFetchTime = 0;

/**
 * Normalizes an order record into a unified shape.
 */
function normalizeOrder(o: any): CloudOrderPayload {
  const id = String(o.id || o.order_no || o.serverId || `ORD-${Date.now()}`);
  return {
    id,
    order_no: o.order_no || o.id || id,
    serverId: o.serverId || id,
    userId: o.userId || o.customer_id || '',
    userEmail: o.userEmail || '',
    customerName: o.customerName || o.customer_name || 'Customer',
    customer_name: o.customer_name || o.customerName || 'Customer',
    customerPhone: o.customerPhone || o.phone || '',
    customerAddress: o.customerAddress || o.address || '',
    itemsSummary: o.itemsSummary || (o.lines ? o.lines.map((l: any) => l.name_snapshot || l.title).join(', ') : 'Healthy Meals'),
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
    channel: o.channel || (id.toLowerCase().includes('sub') ? 'subscription' : 'direct'),
    deleted: Boolean(o.deleted),
  };
}

/**
 * Fetches all orders from the cloud sync bin.
 */
export async function fetchCloudOrders(): Promise<CloudOrderPayload[]> {
  try {
    const res = await fetch(CLOUD_ORDERS_BIN, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.orders)) {
        memoryOrdersCache = data.orders.map(normalizeOrder);
        lastFetchTime = Date.now();
        // Also update local storage backup
        try {
          localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(memoryOrdersCache));
        } catch {}
        return memoryOrdersCache;
      }
    }
  } catch (err) {
    console.warn('Cloud sync fetch error:', err);
  }

  // Fallback to local cache if offline
  try {
    const cached = localStorage.getItem('brokole-cloud-orders-cache');
    if (cached) {
      memoryOrdersCache = JSON.parse(cached);
      return memoryOrdersCache;
    }
  } catch {}

  return memoryOrdersCache;
}

/**
 * Pushes a new order or updates an existing order in the cloud store.
 */
export async function pushCloudOrder(order: any): Promise<void> {
  const norm = normalizeOrder(order);

  // Optimistic update
  const existingIdx = memoryOrdersCache.findIndex(
    (o) => o.id === norm.id || (norm.order_no && o.order_no === norm.order_no)
  );

  if (existingIdx >= 0) {
    memoryOrdersCache[existingIdx] = { ...memoryOrdersCache[existingIdx], ...norm };
  } else {
    memoryOrdersCache.unshift(norm);
  }

  // Save to local cache immediately
  try {
    localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(memoryOrdersCache));
  } catch {}

  // Also push to local dev server endpoint if running on localhost
  try {
    fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: norm }),
    }).catch(() => {});
  } catch {}

  // Push to Global Cloud Bin
  try {
    // Re-fetch latest first to avoid overwriting orders placed by other devices
    let currentOrders = memoryOrdersCache;
    try {
      const freshRes = await fetch(CLOUD_ORDERS_BIN, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        if (Array.isArray(freshData?.orders)) {
          const freshNormalized = freshData.orders.map(normalizeOrder);
          const map = new Map<string, CloudOrderPayload>();
          freshNormalized.forEach((o: CloudOrderPayload) => map.set(o.id, o));
          memoryOrdersCache.forEach((o: CloudOrderPayload) => map.set(o.id, o));
          map.set(norm.id, norm);
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
 * Updates an order status across all devices.
 */
export async function updateCloudOrderStatus(orderId: string, newStatus: string): Promise<void> {
  const targetId = String(orderId).toLowerCase();

  let targetFound: CloudOrderPayload | null = null;
  memoryOrdersCache = memoryOrdersCache.map((o) => {
    if (String(o.id).toLowerCase() === targetId || String(o.order_no).toLowerCase() === targetId) {
      targetFound = { ...o, status: newStatus };
      return targetFound;
    }
    return o;
  });

  if (targetFound) {
    await pushCloudOrder(targetFound);
  } else {
    // If not in cache, create status delta
    await pushCloudOrder({ id: orderId, status: newStatus });
  }
}

/**
 * Global Power Bowl Sync
 */
export async function fetchCloudPowerBowl(): Promise<any[]> {
  try {
    const res = await fetch(CLOUD_POWER_BOWL_BIN, {
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

  // Fallback to local dev server sync
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
