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

export function OrdersScreen({ session }: { session: AdminSession }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!isApiConfigured) { setLoading(false); return; }
    try {
      const { orders } = await api.get<{ orders: Order[] }>('/orders');
      setOrders(orders);
    } catch (e) {
      toast.error('Could not load orders', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  // Live board by polling.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void fetchOrders();
    };
    const interval = window.setInterval(tick, 6000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchOrders]);

  async function advance(order: Order) {
    const to = nextStatus(order.status);
    if (!to) return;

    setWorking(order.id);
    try {
      await api.patch(`/orders/${order.id}/status`, { status: to });
      toast.success(`${order.order_no} → ${ORDER_STATUS_LABELS[to]}`);
      await fetchOrders();
    } catch (e) {
      toast.error('Could not update the order', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setWorking(null);
    }
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
