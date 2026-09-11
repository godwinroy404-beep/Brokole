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

let inFlightFetchPromise: Promise<CloudOrderPayload[]> | null = null;

/**
 * Returns a canonical key string to reliably match an order across any data source.
 */
export function getCanonicalCloudKey(o: any): string {
  if (!o) return '';
  const orderNo = String(o.order_no || '').trim().toLowerCase();
  const id = String(o.id || '').trim().toLowerCase();
  const serverId = String(o.serverId || '').trim().toLowerCase();
  return orderNo || id || serverId || '';
}

/**
 * Normalizes an order record into a unified shape.
 */
export function normalizeCloudOrder(o: any): CloudOrderPayload {
  const existingKey = String(o.id || o.order_no || o.serverId || '');
  const id = existingKey || `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const order_no = String(o.order_no || o.id || id);
  const serverId = String(o.serverId || o.id || id);

  const itemsSummary = o.itemsSummary || (o.lines ? o.lines.map((l: any) => l.name_snapshot || l.title).join(', ') : 'Healthy Meals');
  const isSubscription =
    o.channel === 'subscription' ||
    id.toLowerCase().includes('sub') ||
    order_no.toLowerCase().includes('sub') ||
    itemsSummary.toLowerCase().includes('plan') ||
    itemsSummary.toLowerCase().includes('subscription') ||
    itemsSummary.toLowerCase().includes('weekly') ||
    itemsSummary.toLowerCase().includes('monthly') ||
    itemsSummary.toLowerCase().includes('shred');

  return {
    id,
    order_no,
    serverId,
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
 * Fetches all orders from the global cloud sync store with deduplicated in-flight requests and multi-tier merging.
 */
export async function fetchCloudOrders(): Promise<CloudOrderPayload[]> {
  if (inFlightFetchPromise) {
    return inFlightFetchPromise;
  }

  inFlightFetchPromise = (async () => {
    try {
      // 1. Concurrently fetch cloud bin (authoritative persistent store) and local/serverless sync endpoint
      const [cloudResResult, localResResult] = await Promise.allSettled([
        fetch(`${CLOUD_ORDERS_BIN}?_t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/local-orders-sync?_t=${Date.now()}`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        }),
      ]);

      const fetchedList: CloudOrderPayload[] = [];

      // Process Cloud Bin result
      if (cloudResResult.status === 'fulfilled' && cloudResResult.value.ok) {
        try {
          const text = await cloudResResult.value.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed?.orders)) {
            fetchedList.push(...parsed.orders.map(normalizeCloudOrder));
          }
        } catch {}
      }

      // Process Local / Serverless sync result
      if (localResResult.status === 'fulfilled' && localResResult.value.ok) {
        try {
          const data = await localResResult.value.json();
          if (Array.isArray(data?.orders)) {
            fetchedList.push(...data.orders.map(normalizeCloudOrder));
          }
        } catch {}
      }

      // 2. Read local fallback storage if network returned nothing
      if (fetchedList.length === 0 && typeof localStorage !== 'undefined') {
        try {
          const cached = localStorage.getItem('brokole-cloud-orders-cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              fetchedList.push(...parsed.map(normalizeCloudOrder));
            }
          }
        } catch {}
      }

      let dismissedSet = new Set<string>();
      try {
        if (typeof localStorage !== 'undefined') {
          const rawDismissed = localStorage.getItem('brokole-dismissed-orders');
          if (rawDismissed) {
            Object.keys(JSON.parse(rawDismissed)).forEach((id) => dismissedSet.add(String(id).trim().toLowerCase()));
          }
          const rawSubDismissed = localStorage.getItem('bkl_dismissed_sub_ids');
          if (rawSubDismissed) {
            const parsed = JSON.parse(rawSubDismissed);
            if (Array.isArray(parsed)) parsed.forEach((id) => dismissedSet.add(String(id).trim().toLowerCase()));
          }
        }
      } catch {}

      // 3. Robust canonical-key merging with memoryOrdersCache
      const orderMap = new Map<string, CloudOrderPayload>();

      const isInvalidOrDismissed = (o: any) => {
        if (!o || o.deleted || (o as any).deleted === true) return true;
        const st = String(o.status || '').trim().toLowerCase();
        if (st === 'cancelled' || st === 'canceled' || st === 'refunded') return true;
        const k = getCanonicalCloudKey(o);
        const idLower = String(o.id || '').trim().toLowerCase();
        const noLower = String(o.order_no || '').trim().toLowerCase();
        const serverLower = String(o.serverId || '').trim().toLowerCase();
        if (dismissedSet.has(k) || (idLower && dismissedSet.has(idLower)) || (noLower && dismissedSet.has(noLower)) || (serverLower && dismissedSet.has(serverLower))) {
          return true;
        }
        return false;
      };

      // Index existing cache first (excluding any invalid/deleted/cancelled)
      for (const o of memoryOrdersCache) {
        if (isInvalidOrDismissed(o)) continue;
        const k = getCanonicalCloudKey(o);
        if (k) orderMap.set(k, o);
      }

      // Merge newly fetched orders (they take priority over stale memory cache)
      for (const o of fetchedList) {
        if (!o) continue;
        const k = getCanonicalCloudKey(o);
        if (!k) continue;

        if (isInvalidOrDismissed(o)) {
          orderMap.delete(k);
          const idLower = String(o.id || '').trim().toLowerCase();
          const noLower = String(o.order_no || '').trim().toLowerCase();
          const serverLower = String(o.serverId || '').trim().toLowerCase();
          if (idLower) orderMap.delete(idLower);
          if (noLower) orderMap.delete(noLower);
          if (serverLower) orderMap.delete(serverLower);
          continue;
        }

        const existing = orderMap.get(k);
        if (existing) {
          orderMap.set(k, {
            ...existing,
            ...o,
            // Preserve rich lines/items if incoming order is a summary
            lines: (o.lines && o.lines.length > 0) ? o.lines : existing.lines,
            itemsList: (o.itemsList && o.itemsList.length > 0) ? o.itemsList : existing.itemsList,
          });
        } else {
          orderMap.set(k, o);
        }
      }

      const merged = Array.from(orderMap.values()).sort(
        (a, b) => new Date(b.placed_at || b.createdAt || 0).getTime() - new Date(a.placed_at || a.createdAt || 0).getTime()
      );

      memoryOrdersCache = merged;

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(merged));
        }
      } catch {}

      return merged;
    } catch (err) {
      console.warn('fetchCloudOrders error:', err);
      return memoryOrdersCache;
    } finally {
      inFlightFetchPromise = null;
    }
  })();

  return inFlightFetchPromise;
}

/**
 * Pushes a new order or updates an existing order in the global cloud store.
 */
export async function pushCloudOrder(order: any): Promise<void> {
  const norm = normalizeCloudOrder(order);
  const targetKey = getCanonicalCloudKey(norm);

  // Optimistic memory update with merging
  const existingIdx = memoryOrdersCache.findIndex(
    (o) => getCanonicalCloudKey(o) === targetKey
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
    const map = new Map<string, CloudOrderPayload>();
    try {
      const freshRes = await fetch(`${CLOUD_ORDERS_BIN}?_t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (freshRes.ok) {
        const text = await freshRes.text();
        const freshData = JSON.parse(text);
        if (Array.isArray(freshData?.orders)) {
          freshData.orders.forEach((rawOrd: any) => {
            const o = normalizeCloudOrder(rawOrd);
            const k = getCanonicalCloudKey(o);
            if (k && !o.deleted) map.set(k, o);
          });
        }
      }
    } catch {}

    memoryOrdersCache.forEach((o) => {
      const k = getCanonicalCloudKey(o);
      if (k && !o.deleted) {
        const ex = map.get(k);
        map.set(k, ex ? { ...ex, ...o } : o);
      }
    });

    map.set(targetKey, norm);

    const currentOrders = Array.from(map.values()).sort(
      (a, b) => new Date(b.placed_at || b.createdAt || 0).getTime() - new Date(a.placed_at || a.createdAt || 0).getTime()
    );

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
  const targetKey = String(orderId).trim().toLowerCase();

  // 1. Update memory cache
  memoryOrdersCache = memoryOrdersCache.map((o) => {
    if (getCanonicalCloudKey(o) === targetKey) {
      return { ...o, status: newStatus };
    }
    return o;
  });

  // 2. Fetch fresh cloud orders and merge
  const map = new Map<string, CloudOrderPayload>();
  try {
    const res = await fetch(`${CLOUD_ORDERS_BIN}?_t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.orders)) {
        data.orders.forEach((rawOrd: any) => {
          const o = normalizeCloudOrder(rawOrd);
          const k = getCanonicalCloudKey(o);
          if (k && !o.deleted) map.set(k, o);
        });
      }
    }
  } catch {}

  for (const o of memoryOrdersCache) {
    const k = getCanonicalCloudKey(o);
    if (k && !o.deleted) {
      const existing = map.get(k);
      map.set(k, existing ? { ...existing, ...o } : o);
    }
  }

  // Update target in map
  let matched = false;
  for (const [k, o] of map.entries()) {
    if (k === targetKey || getCanonicalCloudKey(o) === targetKey) {
      map.set(k, { ...o, status: newStatus });
      matched = true;
      break;
    }
  }

  if (!matched) {
    map.set(targetKey, {
      id: orderId,
      order_no: orderId,
      status: newStatus,
      createdAt: new Date().toISOString(),
    });
  }

  const finalOrders = Array.from(map.values()).sort(
    (a, b) => new Date(b.placed_at || b.createdAt || 0).getTime() - new Date(a.placed_at || a.createdAt || 0).getTime()
  );

  memoryOrdersCache = finalOrders;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('brokole-cloud-orders-cache', JSON.stringify(finalOrders));
    }
  } catch {}

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
  const targetKey = String(orderId).trim().toLowerCase();

  // 1. Remove/mark deleted in memory cache
  memoryOrdersCache = memoryOrdersCache.filter(
    (o) => getCanonicalCloudKey(o) !== targetKey
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
        cloudOrders = data.orders
          .map(normalizeCloudOrder)
          .filter((o: any) => getCanonicalCloudKey(o) !== targetKey);
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
