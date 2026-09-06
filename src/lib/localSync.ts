/**
 * Utility for local cross-origin sync between Storefront (port 5174) and Admin (port 5175).
 * Operates over /api/local-orders-sync to share orders when PHP API server is offline.
 */

export async function pushLocalOrderSync(order: any): Promise<void> {
  try {
    await fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
  } catch {
    /* ignore offline fetch errors */
  }
}

export async function fetchLocalSyncOrders(): Promise<any[]> {
  try {
    const res = await fetch('/api/local-orders-sync');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.orders) ? data.orders : [];
  } catch {
    return [];
  }
}
