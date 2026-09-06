import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatINR, nextStatus, ORDER_STATUS_LABELS,
  type Order, type OrderStatus,
} from '@brokole/domain';
import { api, isApiConfigured } from '../lib/api';
import type { AdminSession } from '../lib/useSession';

const STATUS_STYLES: Partial<Record<OrderStatus, string>> = {
  placed:           'bg-amber-100 text-amber-800',
  paid:             'bg-amber-100 text-amber-800',
  accepted:         'bg-blue-100 text-blue-800',
  in_kitchen:       'bg-orange-100 text-orange-800',
  packed:           'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-purple-100 text-purple-800',
  delivered:        'bg-emerald-100 text-emerald-800',
  cancelled:        'bg-neutral-200 text-neutral-600',
  refunded:         'bg-rose-100 text-rose-800',
};

async function fetchDiskOrders(): Promise<Order[]> {
  try {
    const res = await fetch('/api/local-orders-sync');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.orders) || data.orders.length === 0) return [];

    return data.orders.map((o: any) => {
      let st = (o.status || '').toLowerCase();
      if (st === 'new order' || st === 'placed' || st === 'paid') st = 'placed';
      else if (st === 'accepted') st = 'accepted';
      else if (st === 'in_kitchen' || st === 'in kitchen' || st === 'preparing') st = 'in_kitchen';
      else if (st === 'packed') st = 'packed';
      else if (st === 'out for delivery' || st === 'out_for_delivery') st = 'out_for_delivery';
      else if (st === 'delivered') st = 'delivered';
      else if (st === 'cancelled' || st === 'canceled' || st === 'refunded') st = 'cancelled';
      else st = 'placed';

      return {
        id: o.serverId || o.id,
        order_no: o.id || o.order_no || 'BKL-DEMO-001',
        status: st as OrderStatus,
        business_date: new Date(o.createdAt || o.created_at || Date.now()).toISOString().split('T')[0],
        subtotal: o.totalAmount ? Math.round(o.totalAmount * 0.95) : o.total ? Math.round(Number(o.total) * 0.95) : 380,
        tax_amount: o.totalAmount ? Math.round(o.totalAmount * 0.05) : o.total ? Math.round(Number(o.total) * 0.05) : 19,
        delivery_fee: 0,
        total: o.totalAmount || Number(o.total) || 399,
        total_calories: o.calories || o.total_calories || 550,
        total_protein: o.proteinGrams || o.total_protein || 48,
        customer_id: o.userId || 'usr-demo',
        placed_at: o.createdAt || o.created_at || new Date().toISOString(),
        created_at: o.createdAt || o.created_at || new Date().toISOString(),
        notes: o.notes || `${o.customerName || 'Customer'} (${o.customerPhone || ''}) — ${o.itemsSummary || 'Fresh Healthy Meals'}`,
        lines: (o.itemsList || o.lines || []).map((item: any) => ({
          name_snapshot: item.title || item.name_snapshot,
          quantity: item.quantity,
          unit_price: String(item.price || item.unit_price || 0),
          line_total: String((item.price || item.unit_price || 0) * item.quantity),
        })),
      };
    });
  } catch {
    return [];
  }
}

function getFallbackOrders(): Order[] {
  try {
    const raw = localStorage.getItem('brokole-orders-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      const storeOrders = parsed?.state?.orders;
      if (Array.isArray(storeOrders) && storeOrders.length > 0) {
        return storeOrders.map((o: any) => {
          let st = (o.status || '').toLowerCase();
          if (st === 'delivered') st = 'delivered';
          else if (st === 'cancelled' || st === 'canceled') st = 'cancelled';
          else if (st === 'out for delivery' || st === 'out_for_delivery') st = 'out_for_delivery';
          else if (st === 'packed') st = 'packed';
          else if (st === 'in_kitchen' || st === 'in kitchen') st = 'in_kitchen';
          else if (st === 'accepted') st = 'accepted';
          else if (st === 'preparing') st = 'in_kitchen';
          else st = 'placed';

          return {
            id: o.serverId || o.id,
            order_no: o.id || 'BKL-DEMO-001',
            status: st as OrderStatus,
            business_date: new Date(o.createdAt || Date.now()).toISOString().split('T')[0],
            subtotal: o.totalAmount ? Math.round(o.totalAmount * 0.95) : 380,
            tax_amount: o.totalAmount ? Math.round(o.totalAmount * 0.05) : 19,
            delivery_fee: 0,
            total: o.totalAmount || 399,
            total_calories: o.calories || 550,
            total_protein: o.proteinGrams || 48,
            customer_id: o.userId || 'usr-demo',
            placed_at: o.createdAt || new Date().toISOString(),
            created_at: o.createdAt || new Date().toISOString(),
            notes: `${o.customerName || 'Customer'} (${o.customerPhone || ''}) — ${o.itemsSummary || 'High Protein Meals'}`,
            lines: (o.itemsList || []).map((item: any) => ({
              name_snapshot: item.title,
              quantity: item.quantity,
              unit_price: String(item.price),
              line_total: String(item.price * item.quantity),
            })),
          };
        });
      }
    }
  } catch {
    /* fallback to demo array */
  }

  return [
    {
      id: 'ord-101',
      order_no: 'BKL-260907-101',
      status: 'in_kitchen',
      business_date: new Date().toISOString().split('T')[0],
      subtotal: 420,
      tax_amount: 21,
      delivery_fee: 0,
      total: 441,
      total_calories: 620,
      total_protein: 58,
      customer_id: 'usr-1',
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: 'Alex Morgan (+91 70662 12122) — Koramangala',
      lines: [
        { name_snapshot: 'Quinoa Paneer Bowl', quantity: 1, unit_price: '280', line_total: '280' },
        { name_snapshot: 'Berry Protein Smoothie', quantity: 1, unit_price: '140', line_total: '140' },
      ],
    },
    {
      id: 'ord-102',
      order_no: 'BKL-260907-102',
      status: 'accepted',
      business_date: new Date().toISOString().split('T')[0],
      subtotal: 360,
      tax_amount: 18,
      delivery_fee: 0,
      total: 378,
      total_calories: 780,
      total_protein: 64,
      customer_id: 'usr-2',
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: 'Priya Sharma (+91 98230 44122) — Indiranagar',
      lines: [
        { name_snapshot: 'Grilled Chicken & Brown Rice', quantity: 1, unit_price: '360', line_total: '360' },
      ],
    },
  ];
}

export function OrdersScreen({ session }: { session: AdminSession }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchOrders = useCallback(async () => {
    let loaded: Order[] = [];
    if (isApiConfigured) {
      try {
        const { orders: serverOrders } = await api.get<{ orders: Order[] }>('/orders');
        if (serverOrders && serverOrders.length > 0) loaded = serverOrders;
      } catch {
        loaded = [];
      }
    }

    if (loaded.length === 0) {
      const disk = await fetchDiskOrders();
      if (disk.length > 0) loaded = disk;
    }

    if (loaded.length === 0) {
      loaded = getFallbackOrders();
    }

    setOrders(loaded);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  // Live board by polling.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void fetchOrders();
    };
    const interval = window.setInterval(tick, 3000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchOrders]);

function updateLocalOrderStatus(orderNoOrId: string, toDbStatus: OrderStatus) {
  let uiStatus = 'New Order';
  if (toDbStatus === 'accepted' || toDbStatus === 'in_kitchen' || toDbStatus === 'packed') uiStatus = 'Preparing';
  else if (toDbStatus === 'out_for_delivery') uiStatus = 'Out for Delivery';
  else if (toDbStatus === 'delivered') uiStatus = 'Delivered';
  else if (toDbStatus === 'cancelled') uiStatus = 'Cancelled';

  try {
    fetch('/api/local-orders-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: { id: orderNoOrId, status: toDbStatus } }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem('brokole-orders-storage');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const orders = parsed?.state?.orders;
    if (!Array.isArray(orders)) return;

    const updated = orders.map((o: any) =>
      o.id === orderNoOrId || o.serverId === orderNoOrId
        ? { ...o, status: uiStatus, isNew: false }
        : o
    );

    parsed.state.orders = updated;
    localStorage.setItem('brokole-orders-storage', JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

  async function advance(order: Order) {
    const to = nextStatus(order.status);
    if (!to) return;

    setWorking(order.id);
    if (isApiConfigured) {
      try {
        await api.patch(`/orders/${order.id}/status`, { status: to });
      } catch {
        /* ignore server connection error in local mode */
      }
    }

    updateLocalOrderStatus(order.order_no || order.id, to);
    toast.success(`${order.order_no} → ${ORDER_STATUS_LABELS[to]}`);
    await fetchOrders();
    setWorking(null);
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Loading orders…</div>;
  }

  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded');
  const completedOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'refunded');

  const displayedOrders = showCompleted ? orders : activeOrders;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <span>Live Kitchen & Delivery Board</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
              {activeOrders.length} Active
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Active orders currently in kitchen & dispatch queue. Delivered orders move to Order History automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Active vs Completed */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setShowCompleted(false)}
              className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
                !showCompleted ? 'bg-emerald-600 font-bold text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Active Queue ({activeOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setShowCompleted(true)}
              className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
                showCompleted ? 'bg-neutral-800 font-bold text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All / Delivered ({orders.length})
            </button>
          </div>

          <button
            onClick={() => void fetchOrders()}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </div>

      {displayedOrders.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 space-y-1">
          <p className="font-semibold text-neutral-700">No active orders in live queue</p>
          <p className="text-xs text-neutral-400">Delivered & completed orders are stored in Executive Order History.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {displayedOrders.map((order) => {
          const to = nextStatus(order.status);
          const hasTaxOrDelivery = Number(order.tax_amount) > 0 || Number(order.delivery_fee) > 0;

          return (
            <div key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs hover:shadow-xs transition-all space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-black text-neutral-900 tracking-tight">{order.order_no}</div>
                  <div className="text-[11px] text-neutral-500 font-semibold">{order.business_date}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black shadow-2xs ${STATUS_STYLES[order.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-neutral-100">
                <span className="text-xl font-black text-neutral-900">{formatINR(order.total)}</span>
                <span className="text-xs text-neutral-500 font-bold">
                  {Math.round(Number(order.total_protein))}g protein · {Math.round(Number(order.total_calories))} kcal
                </span>
              </div>

              {hasTaxOrDelivery && (
                <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium bg-neutral-50/80 px-2.5 py-1.5 rounded-lg border border-neutral-100">
                  <span>Sub: <strong className="text-neutral-800 font-bold">{formatINR(order.subtotal)}</strong></span>
                  {Number(order.tax_amount) > 0 && (
                    <span>GST (5%): <strong className="text-neutral-800 font-bold">{formatINR(order.tax_amount)}</strong></span>
                  )}
                  <span>Delivery: <strong className="text-neutral-800 font-bold">{Number(order.delivery_fee) > 0 ? formatINR(order.delivery_fee) : 'FREE'}</strong></span>
                </div>
              )}

              {order.notes && (
                <p className="text-xs text-neutral-700 bg-amber-50/80 border border-amber-200/60 p-2.5 rounded-xl">
                  <span className="font-extrabold text-amber-900">Note:</span> {order.notes}
                </p>
              )}

              {/* Items & Custom Selected Ingredients Breakdown */}
              {order.lines && order.lines.length > 0 && (
                <div className="space-y-2 border-t border-neutral-100 pt-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                    Ordered Items & Ingredients
                  </span>
                  {order.lines.map((line, idx) => (
                    <div key={idx} className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-800 border border-neutral-200/70 space-y-1">
                      <div className="flex items-center justify-between font-extrabold text-neutral-900">
                        <span>{line.quantity}x {line.name_snapshot}</span>
                        <span className="font-black text-neutral-900">{formatINR(line.line_total || (Number(line.unit_price) * line.quantity))}</span>
                      </div>
                      {line.notes && (
                        <div className="mt-1.5 text-[11px] text-emerald-950 bg-emerald-50/90 p-2 rounded-lg border border-emerald-200/80 font-medium leading-relaxed">
                          <span className="font-extrabold text-emerald-900 block mb-0.5">🥗 Selected Custom Ingredients:</span>
                          {line.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {to && session.can('orders.update.status') && (
                <button
                  onClick={() => void advance(order)}
                  disabled={working === order.id}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] px-4 py-2.5 text-xs font-black text-white transition-all shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {working === order.id ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                  Mark {ORDER_STATUS_LABELS[to]}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
