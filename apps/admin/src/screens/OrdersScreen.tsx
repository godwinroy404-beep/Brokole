import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  formatINR, nextStatus, ORDER_STATUS_LABELS, ORDER_ACTION_LABELS,
  type Order, type OrderStatus,
  fetchCloudOrders, updateCloudOrderStatus, clearAllCloudOrders, deleteCloudOrder,
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

const ACTION_BUTTON_CONFIG: Partial<
  Record<
    OrderStatus,
    {
      bg: string;
      hover: string;
      text: string;
      label: string;
    }
  >
> = {
  placed: {
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-500',
    text: 'text-white',
    label: 'Accept & Start Cooking',
  },
  paid: {
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-500',
    text: 'text-white',
    label: 'Accept & Start Cooking',
  },
  accepted: {
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-500',
    text: 'text-white',
    label: 'Start Cooking',
  },
  in_kitchen: {
    bg: 'bg-indigo-600',
    hover: 'hover:bg-indigo-500',
    text: 'text-white',
    label: 'Hand to Rider (Out for Delivery)',
  },
  packed: {
    bg: 'bg-indigo-600',
    hover: 'hover:bg-indigo-500',
    text: 'text-white',
    label: 'Hand to Rider (Out for Delivery)',
  },
  out_for_delivery: {
    bg: 'bg-emerald-700',
    hover: 'hover:bg-emerald-600',
    text: 'text-white',
    label: 'Confirm Delivered',
  },
};

function getDismissedSet(): Set<string> {
  const set = new Set<string>();
  try {
    const subDismissed = localStorage.getItem('bkl_dismissed_sub_ids');
    if (subDismissed) {
      const parsed = JSON.parse(subDismissed);
      if (Array.isArray(parsed)) parsed.forEach((id) => set.add(String(id).toLowerCase()));
    }
    const ordDismissed = localStorage.getItem('brokole-dismissed-orders');
    if (ordDismissed) {
      const parsed = JSON.parse(ordDismissed);
      Object.keys(parsed).forEach((id) => set.add(String(id).toLowerCase()));
    }
  } catch {}
  return set;
}

async function fetchDiskOrders(dismissedSet?: Set<string>): Promise<Order[]> {
  try {
    const res = await fetch('/api/local-orders-sync');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.orders) || data.orders.length === 0) return [];

    const dismissed = dismissedSet || getDismissedSet();

    return data.orders
      .filter((o: any) => {
        if (!o || o.deleted || (o as any).deleted === true) return false;
        const idLower = String(o.id || '').toLowerCase();
        const noLower = String(o.order_no || '').toLowerCase();
        if (dismissed.has(idLower) || dismissed.has(noLower)) return false;
        const st = (o.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'canceled' || st === 'refunded') return false;
        return true;
      })
      .map((o: any) => {
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
          notes: o.notes || `${o.customerName || 'Customer'} (${o.customerPhone || ''}) - ${o.itemsSummary || 'Fresh Healthy Meals'}`,
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

function getFallbackOrders(dismissedSet?: Set<string>): Order[] {
  try {
    const raw = localStorage.getItem('brokole-orders-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      const storeOrders = parsed?.state?.orders;
      if (Array.isArray(storeOrders) && storeOrders.length > 0) {
        const dismissed = dismissedSet || getDismissedSet();
        return storeOrders
          .filter((o: any) => {
            if (!o || o.deleted || (o as any).deleted === true) return false;
            const idLower = String(o.id || '').toLowerCase();
            const noLower = String(o.serverId || '').toLowerCase();
            if (dismissed.has(idLower) || dismissed.has(noLower)) return false;
            const st = (o.status || '').toLowerCase();
            if (st === 'cancelled' || st === 'canceled' || st === 'refunded') return false;
            return true;
          })
          .map((o: any) => {
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
              notes: `${o.customerName || 'Customer'} (${o.customerPhone || ''}) - ${o.itemsSummary || 'High Protein Meals'}`,
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
    /* fallback to empty array */
  }

  return [];
}

interface OrderCardProps {
  order: Order;
  session: AdminSession;
  working: string | null;
  liveSkippedDates: string[];
  onAdvance: (order: Order) => void;
  onCancel: (order: Order) => void;
}

const OrderCard = React.memo(function OrderCard({ order, session, working, liveSkippedDates, onAdvance, onCancel }: OrderCardProps) {
  const to = nextStatus(order.status);
  const hasTaxOrDelivery = Number(order.tax_amount) > 0 || Number(order.delivery_fee) > 0;

  const todayIso = new Date().toISOString().split('T')[0];
  const todayDayNum = new Date().getDate();

  const isSubscription =
    (order as any).channel === 'subscription' ||
    order.order_no.startsWith('BKL-SUB-') ||
    (order.notes && (
      order.notes.toLowerCase().includes('plan') ||
      order.notes.toLowerCase().includes('subscription') ||
      order.notes.toLowerCase().includes('weekly') ||
      order.notes.toLowerCase().includes('monthly') ||
      order.notes.toLowerCase().includes('pre-order') ||
      order.notes.toLowerCase().includes('pre-booked')
    )) ||
    (order.lines && order.lines.some((l: any) => {
      const name = (l.name_snapshot || l.title || '').toLowerCase();
      return (
        name.includes('plan') ||
        name.includes('subscription') ||
        name.includes('weekly') ||
        name.includes('monthly') ||
        name.includes('pre-order') ||
        name.includes('pre-booked') ||
        name.includes('shred & gain')
      );
    }));

  const isSkippedToday =
    isSubscription &&
    (liveSkippedDates.includes(todayIso) ||
     liveSkippedDates.includes(String(todayDayNum)) ||
     liveSkippedDates.includes(todayDayNum as any));

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 ${
      isSkippedToday ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-50/20' : 'border-neutral-200'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-black text-neutral-900 tracking-tight flex items-center gap-1.5 flex-wrap">
            <span>{order.order_no}</span>
            {isSubscription ? (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[9px] font-black uppercase tracking-wider border border-purple-200">
                🍱 VIP Subscription
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[9px] font-black uppercase tracking-wider border border-emerald-200">
                🛒 Web Order
              </span>
            )}
          </div>
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

      {/* Skipped Today Notice Banner */}
      {isSkippedToday && (
        <div className="bg-amber-100/90 border border-amber-300 text-amber-950 p-2.5 rounded-xl text-xs flex items-center gap-2 font-bold animate-pulse">
          <span>⚠️</span>
          <span>Customer Skipped Today • Kitchen Cooking Paused</span>
        </div>
      )}

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

      {session.can('orders.update.status') && (
        <div className="space-y-2 pt-1">
          {to && (() => {
            if (isSkippedToday) {
              return (
                <div className="w-full text-center py-2 px-3 rounded-xl bg-neutral-100 text-neutral-500 font-bold text-xs border border-neutral-200">
                  ⏸️ Meal Skipped by Customer (Cooking Paused)
                </div>
              );
            }

            const btnCfg = ACTION_BUTTON_CONFIG[order.status];
            const btnLabel = btnCfg?.label || `Mark ${ORDER_STATUS_LABELS[to]}`;
            const btnBg = btnCfg?.bg || 'bg-emerald-700';
            const btnHover = btnCfg?.hover || 'hover:bg-emerald-600';
            const btnText = btnCfg?.text || 'text-white';

            return (
              <button
                onClick={() => onAdvance(order)}
                disabled={working === order.id}
                className={`w-full flex items-center justify-center gap-2 rounded-xl ${btnBg} ${btnHover} active:scale-[0.99] px-4 py-2.5 text-xs font-black ${btnText} transition-all shadow-sm cursor-pointer disabled:opacity-60`}
              >
                {working === order.id && <Loader2 className="size-3.5 animate-spin" />}
                <span>{btnLabel}</span>
              </button>
            );
          })()}

          {order.status !== 'cancelled' && order.status !== 'refunded' && (
            <button
              onClick={() => onCancel(order)}
              disabled={working === order.id}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 active:scale-[0.99] px-3 py-2 text-xs font-black text-rose-700 transition-all cursor-pointer disabled:opacity-50"
              title="Force cancel order (Admin / Testing Override)"
            >
              <span>CANCEL</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export function OrdersScreen({ session }: { session: AdminSession }) {
  const [orders, setOrders] = useState<Order[]>(() => getFallbackOrders());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewFilter, setViewFilter] = useState<'active' | 'skipped' | 'all'>('active');
  const [channelFilter, setChannelFilter] = useState<'all' | 'web' | 'subscription'>('all');

  const [liveSkippedDates, setLiveSkippedDates] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bkl_skipped_dates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchOrders = useCallback(async (isManual = false) => {
    if (isManual) setIsSyncing(true);

    const dismissedSet = getDismissedSet();
    const orderMap = new Map<string, Order>();

    // 1. Fallback base orders first
    for (const o of getFallbackOrders(dismissedSet)) {
      const key = String(o.order_no || o.id).toLowerCase();
      orderMap.set(key, o);
    }

    // 2. Disk sync orders
    const disk = await fetchDiskOrders(dismissedSet);
    for (const o of disk) {
      const key = String(o.order_no || o.id).toLowerCase();
      orderMap.set(key, o);
    }

    // 3. Global cloud orders (high priority cross-device sync)
    try {
      const cloudData = await fetchCloudOrders();
      if (Array.isArray(cloudData) && cloudData.length > 0) {
        cloudData
          .filter((o) => {
            if (!o || o.deleted || (o as any).deleted === true) return false;
            const idLower = String(o.id || '').toLowerCase();
            const noLower = String(o.order_no || '').toLowerCase();
            if (dismissedSet.has(idLower) || dismissedSet.has(noLower)) return false;
            const st = (o.status || '').toLowerCase();
            if (st === 'cancelled' || st === 'canceled' || st === 'refunded') return false;
            return true;
          })
          .forEach((o) => {
            let st = (o.status || '').toLowerCase();
            if (st === 'new order' || st === 'placed' || st === 'paid') st = 'placed';
            else if (st === 'accepted') st = 'accepted';
            else if (st === 'in_kitchen' || st === 'in kitchen' || st === 'preparing') st = 'in_kitchen';
            else if (st === 'packed') st = 'packed';
            else if (st === 'out for delivery' || st === 'out_for_delivery') st = 'out_for_delivery';
            else if (st === 'delivered') st = 'delivered';
            else if (st === 'cancelled' || st === 'canceled' || st === 'refunded') st = 'cancelled';
            else st = 'placed';

            const id = o.serverId || o.id;
            const order_no = o.order_no || o.id || 'BKL-DEMO-001';
            const key = String(order_no || id).toLowerCase();

            orderMap.set(key, {
              id,
              order_no,
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
              notes: o.notes || `${o.customerName || 'Customer'} (${o.customerPhone || ''}) - ${o.itemsSummary || 'Fresh Healthy Meals'}`,
              lines: (o.itemsList || []).map((item: any) => ({
                name_snapshot: item.title || item.name_snapshot || 'Healthy Meal',
                quantity: item.quantity || 1,
                unit_price: String(item.price || item.unit_price || 0),
                line_total: String((item.price || item.unit_price || 0) * (item.quantity || 1)),
              })),
            });
          });
      }
    } catch {}

    // 4. Server API orders (highest priority if configured)
    if (isApiConfigured) {
      try {
        const { orders: serverOrders } = await api.get<{ orders: Order[] }>('/orders');
        if (serverOrders && serverOrders.length > 0) {
          for (const o of serverOrders) {
            const key = String(o.order_no || o.id).toLowerCase();
            if (!dismissedSet.has(key) && o.status !== 'cancelled' && o.status !== 'refunded') {
              orderMap.set(key, o);
            }
          }
        }
      } catch {}
    }

    const loaded = Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.placed_at || b.created_at || 0).getTime() - new Date(a.placed_at || a.created_at || 0).getTime()
    );

    setOrders((prev) => {
      if (prev.length === loaded.length) {
        const isIdentical = prev.every((p, idx) => {
          const l = loaded[idx];
          return (
            p.id === l.id &&
            p.order_no === l.order_no &&
            p.status === l.status &&
            p.total === l.total
          );
        });
        if (isIdentical) return prev;
      }
      return loaded;
    });

    try {
      const saved = localStorage.getItem('bkl_skipped_dates');
      if (saved) setLiveSkippedDates(JSON.parse(saved));
    } catch {}

    if (isManual) setIsSyncing(false);
  }, []);

  useEffect(() => {
    void fetchOrders(false);
  }, [fetchOrders]);

  // Live real-time multi-device order sync with 2s polling, broadcast events and skip listener
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'skips_updated' && Array.isArray(ev.data.dates)) {
            setLiveSkippedDates(ev.data.dates);
          }
          void fetchOrders(false);
        };
      }
    } catch {}

    const handleCustom = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setLiveSkippedDates(e.detail);
      } else {
        try {
          const saved = localStorage.getItem('bkl_skipped_dates');
          if (saved) setLiveSkippedDates(JSON.parse(saved));
        } catch {}
      }
      void fetchOrders(false);
    };

    window.addEventListener('bkl-orders-updated', handleCustom);
    window.addEventListener('bkl-skips-updated', handleCustom);
    window.addEventListener('storage', handleCustom);

    const tick = () => {
      void fetchOrders(false);
    };
    const interval = window.setInterval(tick, 2000);
    document.addEventListener('visibilitychange', tick);

    return () => {
      bc?.close();
      window.removeEventListener('bkl-orders-updated', handleCustom);
      window.removeEventListener('bkl-skips-updated', handleCustom);
      window.removeEventListener('storage', handleCustom);
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

  // Update cloud sync immediately so customer device sees update live
  void updateCloudOrderStatus(orderNoOrId, toDbStatus);

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
    if (parsed.state.latestPlacedOrder && (parsed.state.latestPlacedOrder.id === orderNoOrId || parsed.state.latestPlacedOrder.serverId === orderNoOrId)) {
      parsed.state.latestPlacedOrder = { ...parsed.state.latestPlacedOrder, status: uiStatus, isNew: false };
    }
    localStorage.setItem('brokole-orders-storage', JSON.stringify(parsed));
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('bkl-orders-updated'));
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('brokole-live-sync-channel');
      bc.postMessage({ type: 'order_status_updated', orderId: orderNoOrId, id: orderNoOrId, status: toDbStatus });
      bc.close();
    }
  } catch {}
}

  async function advance(order: Order) {
    const to = nextStatus(order.status);
    if (!to) return;

    const orderId = order.order_no || order.id;
    setWorking(order.id);

    // Instant optimistic update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id || o.order_no === order.order_no
          ? { ...o, status: to }
          : o
      )
    );

    if (isApiConfigured) {
      try {
        await api.patch(`/orders/${order.id}/status`, { status: to });
      } catch {
        /* ignore server connection error in local mode */
      }
    }

    updateLocalOrderStatus(orderId, to);

    if (to === 'delivered') {
      toast.success(`Order ${order.order_no} marked Delivered! 🎉`, {
        description: 'Moved to completed orders & customer notified.',
      });
    } else if (to === 'out_for_delivery') {
      toast.success(`Order ${order.order_no} handed to Rider 🛵`, {
        description: 'Status updated to Out for Delivery.',
      });
    } else if (to === 'in_kitchen') {
      toast.success(`Order ${order.order_no} accepted & cooking in kitchen 🍳`, {
        description: 'Customer live tracking updated to Preparing.',
      });
    } else {
      toast.success(`${order.order_no} → ${ORDER_STATUS_LABELS[to]}`);
    }

    await fetchOrders(false);
    setWorking(null);
  }

  async function cancelOrder(order: Order) {
    if (!window.confirm(`Delete & cancel order ${order.order_no}? This will remove it from the customer view as well.`)) return;

    const orderId = order.id;
    const orderNo = order.order_no || order.id;

    setWorking(order.id);

    // Remove from state immediately
    setOrders((prev) => prev.filter((o) => o.id !== orderId && o.order_no !== orderNo && o.id !== orderNo));

    // 1. Delete from cloud store
    void deleteCloudOrder(orderId);
    if (orderNo && orderNo !== orderId) {
      void deleteCloudOrder(orderNo);
    }

    // 2. Add to dismissed IDs
    try {
      const subDismissed = localStorage.getItem('bkl_dismissed_sub_ids');
      const parsedSub = subDismissed ? JSON.parse(subDismissed) : [];
      const nextSub = [...new Set([...parsedSub, orderId, orderNo])];
      localStorage.setItem('bkl_dismissed_sub_ids', JSON.stringify(nextSub));

      const ordDismissed = localStorage.getItem('brokole-dismissed-orders');
      const parsedOrd = ordDismissed ? JSON.parse(ordDismissed) : {};
      parsedOrd[orderId] = Date.now();
      parsedOrd[orderNo] = Date.now();
      localStorage.setItem('brokole-dismissed-orders', JSON.stringify(parsedOrd));
    } catch {}

    // 3. Post delete action to local sync
    try {
      await fetch('/api/local-orders-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          orderId,
          order_no: orderNo,
        }),
      });
    } catch {}

    if (isApiConfigured) {
      try {
        await api.patch(`/orders/${encodeURIComponent(orderId)}/status`, { status: 'cancelled' });
      } catch {}
    }

    updateLocalOrderStatus(orderNo, 'cancelled');

    // 4. Broadcast deletion to all browser tabs and customer live tracker
    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('bkl-orders-updated'));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.postMessage({ type: 'order_deleted', orderId, id: orderId, order_no: orderNo });
        bc.postMessage({ type: 'order_status_updated', orderId, id: orderId, status: 'cancelled' });
        bc.close();
      }
    } catch {}

    toast.success(`Order ${orderNo} deleted & removed from customer app`, {
      description: 'Order purged from live board and customer account.',
    });
    setWorking(null);
  }

  const handleDeleteAllOrders = async () => {
    if (!window.confirm('Are you sure you want to delete ALL active & completed orders for testing? This will wipe the order list across all devices.')) {
      return;
    }

    setIsDeletingAll(true);
    try {
      // 1. Clear global cloud store
      await clearAllCloudOrders();

      // 2. Clear local disk sync store
      await fetch('/api/local-orders-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_all', orders: [] }),
      }).catch(() => {});

      // 3. Clear localStorage in browser
      try {
        localStorage.setItem('brokole-orders-storage', JSON.stringify({ state: { orders: [], latestPlacedOrder: null } }));
        localStorage.removeItem('brokole-cloud-orders-cache');
      } catch {}

      // 4. Reset orders state
      setOrders([]);

      // 5. Broadcast to all active tabs & customer view
      try {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('bkl-orders-updated'));
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('brokole-live-sync-channel');
          bc.postMessage({ type: 'ORDERS_CLEARED' });
          bc.close();
        }
      } catch {}

      toast.success('All orders deleted for testing!');
    } catch {
      toast.error('Failed to clear orders');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const isSubOrder = (o: Order) =>
    (o as any).channel === 'subscription' ||
    o.order_no.startsWith('BKL-SUB-') ||
    (o.notes && (
      o.notes.toLowerCase().includes('plan') ||
      o.notes.toLowerCase().includes('subscription') ||
      o.notes.toLowerCase().includes('weekly') ||
      o.notes.toLowerCase().includes('monthly') ||
      o.notes.toLowerCase().includes('pre-order') ||
      o.notes.toLowerCase().includes('pre-booked')
    )) ||
    (o.lines && o.lines.some((l: any) => {
      const name = (l.name_snapshot || l.title || '').toLowerCase();
      return (
        name.includes('plan') ||
        name.includes('subscription') ||
        name.includes('weekly') ||
        name.includes('monthly') ||
        name.includes('pre-order') ||
        name.includes('pre-booked') ||
        name.includes('shred & gain')
      );
    }));

  const isOrderSkippedToday = (o: Order) => {
    if (!isSubOrder(o)) return false;
    const todayIso = new Date().toISOString().split('T')[0];
    const todayDayNum = new Date().getDate();
    return (
      liveSkippedDates.includes(todayIso) ||
      liveSkippedDates.includes(String(todayDayNum)) ||
      liveSkippedDates.includes(todayDayNum as any)
    );
  };

  const activeOrders = orders.filter((o) => {
    if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'refunded') return false;
    if (isOrderSkippedToday(o)) return false;
    return true;
  });

  const skippedTodayOrders = orders.filter((o) => isOrderSkippedToday(o));
  const completedOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'refunded');

  let baseOrders = activeOrders;
  if (viewFilter === 'all') {
    baseOrders = orders;
  } else if (viewFilter === 'skipped') {
    baseOrders = skippedTodayOrders;
  }

  const displayedOrders = baseOrders.filter((o) => {
    if (channelFilter === 'web') return !isSubOrder(o);
    if (channelFilter === 'subscription') return isSubOrder(o);
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <span>Live Kitchen & Delivery Board</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
              {activeOrders.length} Active
            </span>
            {skippedTodayOrders.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black border border-amber-300">
                {skippedTodayOrders.length} Skipped Today
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-medium">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Auto-updating in background. Skipped subscription meals are automatically excluded from today's active kitchen queue.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Active vs Skipped Today vs All Orders */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-xs font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => { setViewFilter('active'); setShowCompleted(false); }}
              className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
                viewFilter === 'active' ? 'bg-emerald-600 font-bold text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Active Queue ({activeOrders.length})
            </button>
            {skippedTodayOrders.length > 0 && (
              <button
                type="button"
                onClick={() => { setViewFilter('skipped'); setShowCompleted(false); }}
                className={`rounded-md px-2.5 py-1 transition cursor-pointer flex items-center gap-1 ${
                  viewFilter === 'skipped' ? 'bg-amber-500 font-bold text-white shadow-xs' : 'text-amber-800 hover:text-amber-950 bg-amber-50'
                }`}
              >
                <span>⏸ Skipped Today</span>
                <span className="text-[10px] font-black opacity-90">({skippedTodayOrders.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => { setViewFilter('all'); setShowCompleted(true); }}
              className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
                viewFilter === 'all' ? 'bg-neutral-800 font-bold text-white' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All / History ({orders.length})
            </button>
          </div>

          {/* Delete All Orders (Testing) Button */}
          {orders.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllOrders}
              disabled={isDeletingAll}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition shadow-2xs cursor-pointer disabled:opacity-75"
              title="Delete all active and delivered orders for testing"
            >
              <Trash2 className={`size-3.5 ${isDeletingAll ? 'animate-spin' : 'text-rose-600'}`} />
              <span>{isDeletingAll ? 'Deleting…' : 'Delete All (Testing)'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              void fetchOrders(true);
            }}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs cursor-pointer disabled:opacity-75"
            title="Refresh orders section"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isSyncing ? 'Syncing…' : 'Refresh Orders'}</span>
          </button>
        </div>
      </div>

      {/* Channel Filters: All vs Web Store Orders vs Subscriptions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setChannelFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            channelFilter === 'all'
              ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          All Types ({baseOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setChannelFilter('web')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
            channelFilter === 'web'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <span>🛒 Web Orders</span>
          <span className="text-[10px] opacity-80">({baseOrders.filter((o) => !isSubOrder(o)).length})</span>
        </button>
        <button
          type="button"
          onClick={() => setChannelFilter('subscription')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
            channelFilter === 'subscription'
              ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <span>🍱 VIP Subscriptions</span>
          <span className="text-[10px] opacity-80">({baseOrders.filter((o) => isSubOrder(o)).length})</span>
        </button>
      </div>

      {displayedOrders.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 space-y-1">
          <p className="font-semibold text-neutral-700">No matching orders in live queue</p>
          <p className="text-xs text-neutral-400">Delivered & completed orders are stored in Executive Order History.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {displayedOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            session={session}
            working={working}
            liveSkippedDates={liveSkippedDates}
            onAdvance={advance}
            onCancel={cancelOrder}
          />
        ))}
      </div>
    </div>
  );
}
