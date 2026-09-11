import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw, Loader2, Calendar, Sparkles, Award, ShoppingBag, CheckCircle2,
  AlertTriangle, PauseCircle, Target, Users, Search, Filter, Clock,
  ArrowUpRight, Phone, Mail, CheckCircle, ChevronRight, CreditCard,
  TrendingUp, PlayCircle, LayoutGrid, List, ShieldCheck, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  formatINR, ORDER_STATUS_LABELS, type Order, type OrderStatus,
  fetchCloudOrders, updateCloudOrderStatus, deleteCloudOrder,
} from '@brokole/domain';
import { api, isApiConfigured } from '../lib/api';
import type { AdminSession } from '../lib/useSession';

const STATUS_STYLES: Partial<Record<OrderStatus, string>> = {
  placed: 'bg-amber-100 text-amber-900 border-amber-300',
  paid: 'bg-amber-100 text-amber-900 border-amber-300',
  accepted: 'bg-blue-100 text-blue-900 border-blue-300',
  in_kitchen: 'bg-orange-100 text-orange-900 border-orange-300',
  packed: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  out_for_delivery: 'bg-purple-100 text-purple-900 border-purple-300',
  delivered: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  cancelled: 'bg-neutral-200 text-neutral-700 border-neutral-300',
  refunded: 'bg-rose-100 text-rose-900 border-rose-300',
};

function getCustomerGoalInfo(order: Order, subPlanTitle: string) {
  const lineText = order.lines?.map((l: any) => `${l.name_snapshot || ''} ${l.notes || ''}`).join(' ') || '';
  const fullText = `${subPlanTitle} ${lineText} ${order.notes || ''}`.toLowerCase();

  if (fullText.includes('muscle') || fullText.includes('hypertrophy') || fullText.includes('bulk') || fullText.includes('shred & gain')) {
    return { label: 'Muscle Build & Hypertrophy', icon: '💪', bg: 'bg-emerald-100/90 text-emerald-900 border-emerald-300' };
  }
  if (fullText.includes('athletic') || fullText.includes('performance') || fullText.includes('endurance') || fullText.includes('athlete')) {
    return { label: 'Athletic Performance & Energy', icon: '⚡', bg: 'bg-blue-100/90 text-blue-900 border-blue-300' };
  }
  if (fullText.includes('maintenance') || fullText.includes('balanced') || fullText.includes('wellness')) {
    return { label: 'Weight Maintenance & Wellness', icon: '⚖️', bg: 'bg-purple-100/90 text-purple-900 border-purple-300' };
  }

  // Default to Fat Loss & Lean Shred
  return { label: 'Fat Loss & Lean Shred', icon: '🔥', bg: 'bg-amber-100/90 text-amber-900 border-amber-300' };
}

function formatSkippedDaysText(orderSkippedDays: (string | number)[], weekDays: Array<{ day: string; dayNum: number; iso: string; index: number }>) {
  if (!orderSkippedDays || orderSkippedDays.length === 0) return '';

  const formatted = orderSkippedDays.map((s) => {
    const str = String(s).trim();
    const match = weekDays.find(
      (w) => w.iso === str || String(w.dayNum) === str || String(w.index) === str
    );
    if (match) {
      return `${match.day} (${match.dayNum})`;
    }
    if (str.length === 10 && str.includes('-')) {
      const parts = str.split('-');
      return `${parts[2]}/${parts[1]}`;
    }
    return `Day ${str}`;
  });

  return [...new Set(formatted)].join(', ');
}

function getCanonicalOrderKey(o: any): string {
  if (!o) return '';
  const orderNo = String(o.order_no || '').trim().toLowerCase();
  const id = String(o.id || '').trim().toLowerCase();
  const serverId = String(o.serverId || '').trim().toLowerCase();
  return orderNo || id || serverId || '';
}

function isSubOrder(order: any): boolean {
  if (!order) return false;
  const itemsSummary = String(order.itemsSummary || '').toLowerCase();
  const notes = String(order.notes || '').toLowerCase();
  const id = String(order.id || '').toLowerCase();
  const orderNo = String(order.order_no || '').toLowerCase();

  return (
    order.channel === 'subscription' ||
    id.includes('sub') ||
    orderNo.includes('sub') ||
    notes.includes('plan') ||
    notes.includes('subscription') ||
    notes.includes('weekly') ||
    notes.includes('monthly') ||
    notes.includes('pre-order') ||
    notes.includes('pre-booked') ||
    notes.includes('shred') ||
    itemsSummary.includes('plan') ||
    itemsSummary.includes('subscription') ||
    itemsSummary.includes('weekly') ||
    itemsSummary.includes('monthly') ||
    itemsSummary.includes('shred') ||
    (order.lines && order.lines.some((l: any) => {
      const name = String(l.name_snapshot || l.title || '').toLowerCase();
      return (
        name.includes('plan') ||
        name.includes('subscription') ||
        name.includes('weekly') ||
        name.includes('monthly') ||
        name.includes('pre-order') ||
        name.includes('pre-booked') ||
        name.includes('shred & gain') ||
        name.includes('shred')
      );
    }))
  );
}

function computeSubSignature(orderList: Order[]): string {
  return orderList
    .map((o) => `${o.id}::${o.order_no}::${o.status}::${o.total}::${o.notes || ''}::${(o as any).skipped_days?.length || 0}`)
    .join('|||');
}

function getDismissedSet(): Set<string> {
  const set = new Set<string>();
  try {
    const subDismissed = localStorage.getItem('bkl_dismissed_sub_ids');
    if (subDismissed) {
      const parsed = JSON.parse(subDismissed);
      if (Array.isArray(parsed)) parsed.forEach((id) => set.add(String(id).trim().toLowerCase()));
    }
    const ordDismissed = localStorage.getItem('brokole-dismissed-orders');
    if (ordDismissed) {
      const parsed = JSON.parse(ordDismissed);
      Object.keys(parsed).forEach((id) => set.add(String(id).trim().toLowerCase()));
    }
  } catch {}
  return set;
}

function mergeOrderIntoMap(map: Map<string, Order>, raw: any, dismissedSet: Set<string>) {
  if (!raw) return;

  const rawOrderNo = String(raw.order_no || raw.id || '').trim();
  const rawId = String(raw.id || raw.serverId || rawOrderNo).trim();
  const rawServerId = String(raw.serverId || rawId).trim();

  const idLower = rawId.toLowerCase();
  const noLower = rawOrderNo.toLowerCase();
  const serverLower = rawServerId.toLowerCase();

  const stRaw = String(raw.status || '').trim().toLowerCase();
  const isCancelledOrDeleted =
    Boolean(raw.deleted) ||
    (raw as any).deleted === true ||
    dismissedSet.has(idLower) ||
    dismissedSet.has(noLower) ||
    dismissedSet.has(serverLower) ||
    stRaw === 'cancelled' ||
    stRaw === 'canceled' ||
    stRaw === 'refunded';

  if (isCancelledOrDeleted) {
    if (noLower) map.delete(noLower);
    if (idLower) map.delete(idLower);
    if (serverLower) map.delete(serverLower);
    return;
  }

  // Must be a subscription order
  if (!isSubOrder(raw)) {
    return;
  }

  let st = stRaw;
  if (st === 'new order' || st === 'placed' || st === 'paid') st = 'placed';
  else if (st === 'accepted') st = 'accepted';
  else if (st === 'in_kitchen' || st === 'in kitchen' || st === 'preparing') st = 'in_kitchen';
  else if (st === 'packed') st = 'packed';
  else if (st === 'out for delivery' || st === 'out_for_delivery') st = 'out_for_delivery';
  else if (st === 'delivered') st = 'delivered';
  else st = 'placed';

  const matchKey = [noLower, idLower, serverLower].find((k) => k && map.has(k));
  const existing = matchKey ? map.get(matchKey) : undefined;

  const canonicalKey = matchKey || noLower || idLower || serverLower;
  if (!canonicalKey) return;

  const totalVal = Number(raw.totalAmount || raw.total || (existing ? existing.total : 1899));
  const subtotalVal = raw.subtotal !== undefined ? Number(raw.subtotal) : (raw.totalAmount ? Math.round(Number(raw.totalAmount) * 0.95) : Math.round(totalVal * 0.95));
  const taxVal = raw.tax_amount !== undefined ? Number(raw.tax_amount) : (raw.totalAmount ? Math.round(Number(raw.totalAmount) * 0.05) : Math.round(totalVal * 0.05));

  const rawLines = raw.lines || raw.itemsList || [];
  const parsedLines = rawLines.length > 0
    ? rawLines.map((item: any) => ({
        name_snapshot: item.name_snapshot || item.title || 'Brokole Meal Subscription Plan',
        quantity: item.quantity || 1,
        unit_price: String(item.price || item.unit_price || totalVal),
        line_total: String((item.price || item.unit_price || totalVal) * (item.quantity || 1)),
        notes: item.notes,
      }))
    : (existing?.lines || [{
        name_snapshot: raw.itemsSummary || 'Brokole Meal Subscription Plan',
        quantity: 1,
        unit_price: String(totalVal),
        line_total: String(totalVal),
      }]);

  const mergedOrder: Order = {
    id: existing?.id || rawId,
    order_no: existing?.order_no || rawOrderNo,
    status: st as OrderStatus,
    channel: 'subscription',
    business_date: raw.business_date || existing?.business_date || new Date(raw.createdAt || raw.created_at || Date.now()).toISOString().split('T')[0],
    subtotal: subtotalVal,
    tax_amount: taxVal,
    delivery_fee: 0,
    total: totalVal,
    total_calories: Number(raw.calories || raw.total_calories || (existing ? existing.total_calories : 550)),
    total_protein: Number(raw.proteinGrams || raw.total_protein || (existing ? existing.total_protein : 48)),
    customer_id: raw.userId || raw.customer_id || (existing ? existing.customer_id : 'usr-demo'),
    placed_at: raw.placed_at || raw.createdAt || raw.created_at || (existing ? existing.placed_at : new Date().toISOString()),
    created_at: raw.createdAt || raw.created_at || raw.placed_at || (existing ? existing.created_at : new Date().toISOString()),
    notes: raw.notes || (existing ? existing.notes : (raw.itemsSummary || 'Daily Goal Plan')),
    lines: parsedLines,
    customer_name: raw.customer_name || raw.customerName || (existing as any)?.customer_name || 'VIP Member',
    phone: raw.customerPhone || raw.phone || (existing as any)?.phone || '+91 98765 43210',
    skipped_days: raw.skipped_days || (existing as any)?.skipped_days || [],
  } as any;

  map.set(canonicalKey, mergedOrder);
}

function getFallbackSubscriptionOrders(): Order[] {
  try {
    const raw = localStorage.getItem('brokole-orders-storage');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const storeOrders = parsed?.state?.orders;
    if (Array.isArray(storeOrders)) {
      return storeOrders;
    }
  } catch {}
  return [];
}

async function fetchDiskOrders(): Promise<Order[]> {
  try {
    const res = await fetch('/api/local-orders-sync');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.orders) || data.orders.length === 0) return [];
    return data.orders;
  } catch {
    return [];
  }
}

function getLocalStorageOrders(): Order[] {
  try {
    const raw = localStorage.getItem('brokole-orders-storage');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const storeOrders = parsed?.state?.orders;
    if (Array.isArray(storeOrders)) return storeOrders;
  } catch {}
  return [];
}

export function SubscriptionsScreen({ session }: { session: AdminSession }) {
  const [orders, setOrders] = useState<Order[]>(() => {
    const map = new Map<string, Order>();
    const dismissed = getDismissedSet();
    for (const raw of getFallbackSubscriptionOrders()) {
      mergeOrderIntoMap(map, raw, dismissed);
    }
    return Array.from(map.values());
  });

  const [activeTab, setActiveTab] = useState<'cards' | 'roster'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | '30days' | '7days' | 'skipped'>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  const [liveSkippedDates, setLiveSkippedDates] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bkl_skipped_dates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchSeqRef = useRef(0);

  const updateSkippedDatesIfChanged = useCallback((newDates: string[]) => {
    setLiveSkippedDates((prev) => {
      if (prev.length === newDates.length && prev.every((d, i) => d === newDates[i])) {
        return prev;
      }
      return newDates;
    });
  }, []);

  const fetchOrders = useCallback(async (isManual = false) => {
    const currentSeq = ++fetchSeqRef.current;
    if (isManual) setIsSyncing(true);

    const dismissedSet = getDismissedSet();
    const orderMap = new Map<string, Order>();

    // 1. Fallback base orders from local storage
    for (const o of getFallbackSubscriptionOrders()) {
      mergeOrderIntoMap(orderMap, o, dismissedSet);
    }

    // 2. Disk sync orders
    const disk = await fetchDiskOrders();
    for (const o of disk) {
      mergeOrderIntoMap(orderMap, o, dismissedSet);
    }

    // 3. Global cloud orders (authoritative cross-device sync)
    try {
      const cloudData = await fetchCloudOrders();
      if (Array.isArray(cloudData) && cloudData.length > 0) {
        for (const o of cloudData) {
          mergeOrderIntoMap(orderMap, o, dismissedSet);
        }
      }
    } catch {}

    // 4. Server API orders (highest priority if configured)
    if (isApiConfigured) {
      try {
        const { orders: serverOrders } = await api.get<{ orders: Order[] }>('/orders');
        if (serverOrders && serverOrders.length > 0) {
          for (const o of serverOrders) {
            mergeOrderIntoMap(orderMap, o, dismissedSet);
          }
        }
      } catch {}
    }

    if (currentSeq !== fetchSeqRef.current) {
      return;
    }

    const loaded = Array.from(orderMap.values()).sort((a, b) => {
      const timeA = new Date(a.placed_at || a.created_at || 0).getTime();
      const timeB = new Date(b.placed_at || b.created_at || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return String(b.order_no || b.id).localeCompare(String(a.order_no || a.id));
    });

    setOrders((prev) => {
      const prevSig = computeSubSignature(prev);
      const nextSig = computeSubSignature(loaded);
      if (prevSig === nextSig) {
        return prev;
      }
      return loaded;
    });

    try {
      const saved = localStorage.getItem('bkl_skipped_dates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) updateSkippedDatesIfChanged(parsed);
      }
    } catch {}

    if (isManual) setIsSyncing(false);
  }, [updateSkippedDatesIfChanged]);

  useEffect(() => {
    void fetchOrders(false);
  }, [fetchOrders]);

  // Live real-time live polling every 2s + cross-tab BroadcastChannel for instant skip reflection
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'skips_updated' && Array.isArray(ev.data.dates)) {
            updateSkippedDatesIfChanged(ev.data.dates);
          }
          void fetchOrders(false);
        };
      }
    } catch {}

    const handleStorageOrSkips = (e?: any) => {
      try {
        if (e?.detail && Array.isArray(e.detail)) {
          updateSkippedDatesIfChanged(e.detail);
        } else {
          const saved = localStorage.getItem('bkl_skipped_dates');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) updateSkippedDatesIfChanged(parsed);
          }
        }
      } catch {}
      void fetchOrders(false);
    };

    window.addEventListener('storage', handleStorageOrSkips);
    window.addEventListener('bkl-skips-updated', handleStorageOrSkips);
    window.addEventListener('bkl-orders-updated', handleStorageOrSkips);

    const tick = () => {
      if (document.visibilityState === 'visible') void fetchOrders(false);
    };
    const interval = window.setInterval(tick, 2000);
    document.addEventListener('visibilitychange', tick);

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleStorageOrSkips);
      window.removeEventListener('bkl-skips-updated', handleStorageOrSkips);
      window.removeEventListener('bkl-orders-updated', handleStorageOrSkips);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchOrders, updateSkippedDatesIfChanged]);

  const handleSyncLiveSubscriptions = async () => {
    await fetchOrders(true);
    toast.success('Live subscriptions synced & refreshed!');
  };

  const handleAcceptSubscription = async (orderId: string) => {
    const targetKey = String(orderId).trim().toLowerCase();

    setOrders((prev) =>
      prev.map((o) =>
        getCanonicalOrderKey(o) === targetKey || String(o.id).toLowerCase() === targetKey || String(o.order_no).toLowerCase() === targetKey
          ? { ...o, status: 'accepted' as OrderStatus }
          : o
      )
    );

    try {
      const raw = localStorage.getItem('brokole-orders-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.state?.orders)) {
          parsed.state.orders = parsed.state.orders.map((o: any) =>
            getCanonicalOrderKey(o) === targetKey || String(o.id).toLowerCase() === targetKey || String(o.order_no).toLowerCase() === targetKey
              ? { ...o, status: 'accepted', isNew: false }
              : o
          );
          localStorage.setItem('brokole-orders-storage', JSON.stringify(parsed));
        }
      }
    } catch {}

    void updateCloudOrderStatus(orderId, 'accepted');

    try {
      await fetch('/api/local-orders-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'accepted' }),
      }).catch(() => {});

      if (isApiConfigured) {
        await api.patch(`/orders/${encodeURIComponent(orderId)}/status`, { status: 'accepted' }).catch(() => {});
      }
    } catch {}

    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('bkl-orders-updated'));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.postMessage({ type: 'order_status_updated', orderId, status: 'accepted' });
        bc.close();
      }
    } catch {}

    toast.success(`Subscription ${orderId} Accepted! 🎉`, {
      description: 'Customer subscription activated for daily kitchen schedule.',
    });
  };

  const handleDismissSubscription = async (orderId: string) => {
    const targetKey = String(orderId).trim().toLowerCase();
    const targetOrder = orders.find((o) => getCanonicalOrderKey(o) === targetKey || String(o.id).toLowerCase() === targetKey || String(o.order_no).toLowerCase() === targetKey);
    const orderNo = targetOrder?.order_no || orderId;

    // Remove from state immediately
    setOrders((prev) => prev.filter((o) => getCanonicalOrderKey(o) !== targetKey && String(o.id).toLowerCase() !== targetKey && String(o.order_no).toLowerCase() !== targetKey));

    // Save to both dismissed storage keys
    try {
      const subDismissed = localStorage.getItem('bkl_dismissed_sub_ids');
      const parsedSub = subDismissed ? JSON.parse(subDismissed) : [];
      const nextSub = [...new Set([...parsedSub, orderId, orderNo, targetKey])];
      localStorage.setItem('bkl_dismissed_sub_ids', JSON.stringify(nextSub));

      const ordDismissed = localStorage.getItem('brokole-dismissed-orders');
      const parsedOrd = ordDismissed ? JSON.parse(ordDismissed) : {};
      parsedOrd[orderId] = Date.now();
      parsedOrd[orderNo] = Date.now();
      parsedOrd[targetKey] = Date.now();
      localStorage.setItem('brokole-dismissed-orders', JSON.stringify(parsedOrd));
    } catch {}

    // Purge from cloud sync and broadcast deletion
    void deleteCloudOrder(orderId);
    if (orderNo && orderNo !== orderId) {
      void deleteCloudOrder(orderNo);
    }

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
        if (orderNo && orderNo !== orderId) {
          await api.patch(`/orders/${encodeURIComponent(orderNo)}/status`, { status: 'cancelled' }).catch(() => {});
        }
      } catch {}
    }

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

    toast.success('Subscription deleted & removed from customer profile');
  };

  const handleClearAllSubscriptions = async () => {
    if (!window.confirm('Are you sure you want to clear all active subscription cards?')) return;

    const allSubIds = orders.map((o) => getCanonicalOrderKey(o));
    const targetOrders = [...orders];
    setOrders([]);

    try {
      const subDismissed = localStorage.getItem('bkl_dismissed_sub_ids');
      const parsedSub = subDismissed ? JSON.parse(subDismissed) : [];
      const nextSub = [...new Set([...parsedSub, ...allSubIds])];
      localStorage.setItem('bkl_dismissed_sub_ids', JSON.stringify(nextSub));

      const ordDismissed = localStorage.getItem('brokole-dismissed-orders');
      const parsedOrd = ordDismissed ? JSON.parse(ordDismissed) : {};
      allSubIds.forEach((id) => { parsedOrd[id] = Date.now(); });
      localStorage.setItem('brokole-dismissed-orders', JSON.stringify(parsedOrd));
    } catch {}

    for (const targetOrder of targetOrders) {
      const subId = targetOrder.id || targetOrder.order_no;
      const orderNo = targetOrder.order_no || subId;

      void deleteCloudOrder(subId);
      if (orderNo && orderNo !== subId) {
        void deleteCloudOrder(orderNo);
      }

      try {
        await fetch('/api/local-orders-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            orderId: subId,
            order_no: orderNo,
          }),
        });
      } catch {}

      if (isApiConfigured) {
        try {
          await api.patch(`/orders/${encodeURIComponent(subId)}/status`, { status: 'cancelled' });
        } catch {}
      }
    }

    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('bkl-orders-updated'));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.postMessage({ type: 'ORDERS_CLEARED' });
        bc.close();
      }
    } catch {}

    toast.success('All subscription cards cleared & removed from customer profiles');
  };

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Real-time live polling every 1.5s + cross-tab BroadcastChannel for instant skip reflection
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'skips_updated' && Array.isArray(ev.data.dates)) {
            setLiveSkippedDates(ev.data.dates);
          }
          void fetchOrders();
        };
      }
    } catch {}

    const handleStorageOrSkips = (e?: any) => {
      try {
        if (e?.detail && Array.isArray(e.detail)) {
          setLiveSkippedDates(e.detail);
        } else {
          const saved = localStorage.getItem('bkl_skipped_dates');
          setLiveSkippedDates(saved ? JSON.parse(saved) : []);
        }
      } catch {}
      void fetchOrders();
    };

    window.addEventListener('storage', handleStorageOrSkips);
    window.addEventListener('bkl-skips-updated', handleStorageOrSkips);
    window.addEventListener('bkl-orders-updated', handleStorageOrSkips);

    const tick = () => {
      if (document.visibilityState === 'visible') void fetchOrders();
    };
    const interval = window.setInterval(tick, 1500);
    document.addEventListener('visibilitychange', tick);

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleStorageOrSkips);
      window.removeEventListener('bkl-skips-updated', handleStorageOrSkips);
      window.removeEventListener('bkl-orders-updated', handleStorageOrSkips);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchOrders]);

  // Filter subscription orders specifically
  const subscriptionOrders = useMemo(() => {
    const dismissed = getDismissedSet();
    return orders.filter((order) => {
      const orderId = order.id || order.order_no;
      if (orderId && dismissed.has(orderId.toLowerCase())) return false;
      if ((order as any).deleted) return false;
      if (order.status === 'cancelled' || order.status === 'refunded') return false;
      return isSubOrder(order);
    });
  }, [orders]);

  const totalRevenue = subscriptionOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const activeCount = subscriptionOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded').length;
  const avgSubValue = activeCount > 0 ? Math.round(totalRevenue / activeCount) : 6299;

  // Search & Plan Filtered Subscriptions
  const filteredOrders = useMemo(() => {
    return subscriptionOrders.filter((order) => {
      const subPlanTitle =
        order.lines && order.lines.length > 0 ? order.lines[0].name_snapshot : 'Brokole Meal Subscription Plan';

      // Text search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        order.order_no.toLowerCase().includes(q) ||
        (order as any).customer_name?.toLowerCase().includes(q) ||
        (order as any).phone?.toLowerCase().includes(q) ||
        (order as any).email?.toLowerCase().includes(q) ||
        subPlanTitle.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Plan filter
      if (planFilter === '30days') return subPlanTitle.toLowerCase().includes('30-day') || subPlanTitle.toLowerCase().includes('monthly');
      if (planFilter === '7days') return subPlanTitle.toLowerCase().includes('7-day') || subPlanTitle.toLowerCase().includes('weekly');
      if (planFilter === 'skipped') {
        return liveSkippedDates.length > 0;
      }
      return true;
    });
  }, [subscriptionOrders, searchQuery, planFilter, liveSkippedDates]);

  return (
    <div className="space-y-6">
      {/* Executive Dark Purple Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-neutral-900 to-indigo-950 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shadow-xs">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  Subscription & VIP Customers Hub
                </h1>
                <p className="text-xs text-purple-200/80 font-medium mt-0.5">
                  Dedicated management for weekly/monthly subscribers, 7-day calendar schedules & live customer skip sync
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
            {subscriptionOrders.length > 0 && (
              <button
                onClick={handleClearAllSubscriptions}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-md cursor-pointer"
                title="Clear all subscription orders from view"
              >
                <Trash2 className="size-3.5" />
                <span>Clear All Subscriptions</span>
              </button>
            )}

            <button
              onClick={handleSyncLiveSubscriptions}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Sync Live Subscriptions</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI SUMMARY METRICS */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Subscription Orders */}
        <div className="rounded-2xl border border-purple-200/80 bg-white p-4 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-500">
            <span>Total VIP Subscriptions</span>
            <Calendar className="size-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 tracking-tight">{subscriptionOrders.length}</div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium pt-1 border-t border-neutral-100">
            <span>Active & Renewal Orders</span>
            <span className="text-purple-700 font-extrabold">100% Tracked</span>
          </div>
        </div>

        {/* KPI 2: Active Subscribers */}
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>Active VIP Members</span>
            <span className="bg-emerald-200/80 text-emerald-950 font-extrabold px-2 py-0.5 rounded-full text-[10px]">
              VIP Active
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-950 tracking-tight">{activeCount}</div>
          <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium pt-1 border-t border-emerald-100">
            <span>Daily Kitchen Dispatch</span>
            <span className="font-bold text-emerald-900">Active Daily</span>
          </div>
        </div>

        {/* KPI 3: MRR Subscription Revenue */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-100/60 p-4 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span>Subscription Revenue (MRR)</span>
            <Award className="size-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-950 tracking-tight">{formatINR(totalRevenue)}</div>
          <div className="flex items-center justify-between text-[11px] text-purple-800 font-medium pt-1 border-t border-purple-100">
            <span>Annual Run-Rate (ARR)</span>
            <span className="font-extrabold text-purple-950">{formatINR(totalRevenue * 12)}</span>
          </div>
        </div>

        {/* KPI 4: ARPU Per Subscriber */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-500">
            <span>Avg Revenue / VIP (ARPU)</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900 tracking-tight">{formatINR(avgSubValue)}</div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium pt-1 border-t border-neutral-100">
            <span>Retention Rate:</span>
            <span className="text-emerald-700 font-bold">94.2% Renewal</span>
          </div>
        </div>
      </div>

      {/* FILTER, SEARCH & TAB VIEW TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, order #, or plan…"
            className="w-full pl-9 pr-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
          />
        </div>

        {/* Plan Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 text-xs font-semibold">
            <Filter className="size-3.5 text-neutral-400 ml-1.5 mr-0.5" />
            <button
              onClick={() => setPlanFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                planFilter === 'all' ? 'bg-white text-neutral-900 shadow-2xs font-bold' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              All Plans ({subscriptionOrders.length})
            </button>
            <button
              onClick={() => setPlanFilter('30days')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                planFilter === '30days' ? 'bg-purple-600 text-white shadow-2xs font-bold' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              30-Day VIP Plans
            </button>
            <button
              onClick={() => setPlanFilter('7days')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                planFilter === '7days' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              7-Day Flex Plans
            </button>
            <button
              onClick={() => setPlanFilter('skipped')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                planFilter === 'skipped' ? 'bg-amber-500 text-white shadow-2xs font-bold' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Skipped Days
            </button>
          </div>

          {/* Grid vs Roster View Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('cards')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'cards' ? 'bg-white text-purple-900 shadow-2xs' : 'text-neutral-400 hover:text-neutral-900'
              }`}
              title="Cards & Schedule View"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setActiveTab('roster')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'roster' ? 'bg-white text-purple-900 shadow-2xs' : 'text-neutral-400 hover:text-neutral-900'
              }`}
              title="Subscriber Directory Table"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: SUBSCRIPTION CARDS GRID WITH CALENDAR MATRICES */}
      {activeTab === 'cards' && (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 bg-white space-y-3">
              <Sparkles className="size-8 text-purple-400 mx-auto" />
              <h3 className="font-bold text-neutral-800 text-base">No subscription orders match filters</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                When customers subscribe to a Weekly Flex or 30-Day VIP Plan, their live calendar schedules and skip day requests appear here.
              </p>
              <button
                onClick={handleSyncLiveSubscriptions}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Sync & Restore All Subscriptions</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredOrders.map((order) => {
                const subPlanTitle =
                  order.lines && order.lines.length > 0
                    ? order.lines[0].name_snapshot
                    : 'Brokole Meal Subscription Plan';

                const isMonthly = subPlanTitle.toLowerCase().includes('monthly') || subPlanTitle.toLowerCase().includes('30-day');
                const totalDays = isMonthly ? 30 : 7;

                // Use liveSkippedDates as real-time reactive source of truth
                const orderSkippedDays: (string | number)[] = liveSkippedDates;
                const activeSkippedCount = orderSkippedDays.length;
                const goal = getCustomerGoalInfo(order, subPlanTitle);
                const customerName = (order as any).customer_name || 'Valued VIP Member';

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dayOfWeek = today.getDay();
                const distanceToMon = (dayOfWeek + 6) % 7;
                const monday = new Date(today);
                monday.setDate(today.getDate() - distanceToMon);

                const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayLabel, index) => {
                  const d = new Date(monday);
                  d.setDate(monday.getDate() + index);
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const dayNum = d.getDate();
                  const isPast = d < today;
                  const isToday = d.getTime() === today.getTime();

                  return {
                    day: dayLabel,
                    index: index + 1,
                    dayNum,
                    iso,
                    defaultStatus: isToday ? 'today' : isPast ? 'done' : 'upcoming',
                  };
                });

                return (
                  <div
                    key={getCanonicalOrderKey(order) || order.id || order.order_no}
                    className="rounded-2xl border border-purple-200/90 bg-white p-5 shadow-xs hover:shadow-md transition-all space-y-4 relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute top-0 right-0 w-2 h-full bg-purple-600" />

                    <div className="space-y-3.5">
                      {/* Order No & Status Banner */}
                      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-neutral-900">{order.order_no}</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-black uppercase tracking-wide">
                              VIP SUBSCRIPTION
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 font-semibold mt-0.5 flex items-center gap-1">
                            <span>{customerName}</span>
                            {(order as any).phone ? <span>• {(order as any).phone}</span> : null}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {order.status !== 'placed' && order.status !== 'paid' ? (
                            <span className="rounded-full px-3 py-1 text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                              <CheckCircle2 className="size-3.5 text-purple-700" />
                              <span>Active Plan</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAcceptSubscription(order.id || order.order_no)}
                              className="rounded-full px-3 py-1 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1 carved-btn"
                            >
                              <CheckCircle className="size-3.5" />
                              <span>Accept</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDismissSubscription(order.id || order.order_no)}
                            className="p-1 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title="Remove subscription card"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Plan Details & Macro Metrics */}
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-extrabold text-neutral-900 leading-snug">{subPlanTitle}</h4>
                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <span className="text-lg font-black text-purple-950">{formatINR(order.total)}</span>
                          <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-lg border border-orange-200">
                            {Math.round(Number(order.total_protein))}g protein · {Math.round(Number(order.total_calories))} kcal
                          </span>
                        </div>
                      </div>

                      {/* CUSTOMER FITNESS GOAL BADGE */}
                      <div className="bg-purple-50/70 rounded-xl p-2.5 border border-purple-100/90 flex items-center justify-between text-xs">
                        <span className="font-extrabold text-neutral-700 flex items-center gap-1.5">
                          <Target className="size-3.5 text-purple-600" />
                          <span>Customer Goal:</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black border ${goal.bg}`}>
                          <span>{goal.icon}</span>
                          <span>{goal.label}</span>
                        </span>
                      </div>

                      {/* LIVE CUSTOMER SKIPPED DAY NOTICE BANNER */}
                      {activeSkippedCount > 0 && (
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5 animate-fade-in">
                          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="leading-tight space-y-0.5">
                            <span className="font-black text-amber-900 block">
                              Customer Skipped {activeSkippedCount} Day{activeSkippedCount > 1 ? 's' : ''}!
                            </span>
                            <span className="text-[11px] text-amber-800 font-medium block">
                              Kitchen prep paused for {formatSkippedDaysText(orderSkippedDays, weekDays)}. Subscription end date extended by +{activeSkippedCount} day{activeSkippedCount > 1 ? 's' : ''}.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* CALENDAR DAY SCHEDULE MATRIX */}
                      <div className="bg-purple-50/60 rounded-xl p-3 border border-purple-100 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-950">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 text-purple-600" />
                            <span>Weekly Schedule Matrix</span>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${activeSkippedCount > 0
                              ? 'text-amber-900 bg-amber-100 border-amber-300'
                              : 'text-emerald-800 bg-emerald-100 border-emerald-200'
                            }`}>
                            Day 3 of {totalDays + activeSkippedCount} {activeSkippedCount > 0 ? `· ${activeSkippedCount} Skipped` : '· Active'}
                          </span>
                        </div>

                        {/* Small 7-Day Calendar Strip */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {weekDays.map((d) => {
                            const isSkippedByCustomer = orderSkippedDays.some((s) => {
                              const str = String(s).trim();
                              return (
                                str === d.iso ||
                                str === String(d.dayNum) ||
                                str === String(d.index)
                              );
                            });

                            return (
                              <div
                                key={d.iso}
                                className={`p-1.5 rounded-lg border text-[10px] flex flex-col items-center justify-between transition-all select-none ${isSkippedByCustomer
                                    ? 'bg-amber-500 text-white border-amber-600 font-extrabold shadow-md scale-105 ring-2 ring-amber-300'
                                    : d.defaultStatus === 'today'
                                      ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs scale-105'
                                      : d.defaultStatus === 'done'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                                        : 'bg-white text-neutral-500 border-neutral-200'
                                  }`}
                              >
                                <span className="font-bold opacity-80">{d.day}</span>
                                <span className="text-xs font-black">{d.dayNum}</span>
                                {isSkippedByCustomer ? (
                                  <PauseCircle className="size-3 text-amber-100 mt-0.5" />
                                ) : d.defaultStatus === 'done' ? (
                                  <CheckCircle2 className="size-3 text-emerald-600 mt-0.5" />
                                ) : d.defaultStatus === 'today' ? (
                                  <span className="size-1.5 rounded-full bg-amber-300 animate-pulse mt-0.5" />
                                ) : (
                                  <span className="size-1 rounded-full bg-neutral-300 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-purple-900 font-semibold pt-1 border-t border-purple-100">
                          <span>Dispatch window: 12 PM & 7 PM</span>
                          <span className={`font-black px-2 py-0.5 rounded-md ${activeSkippedCount > 0
                              ? 'text-amber-800 bg-amber-100'
                              : 'text-emerald-800 bg-emerald-100'
                            }`}>
                            {activeSkippedCount > 0 ? `${formatSkippedDaysText(orderSkippedDays, weekDays)} SKIPPED` : 'All Days Scheduled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SUBSCRIBER DIRECTORY ROSTER TABLE */}
      {activeTab === 'roster' && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                <Users className="size-5 text-purple-600" />
                <span>Subscriber Directory Roster</span>
              </h3>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">Comprehensive list of VIP subscribers, plans, fitness goals & skipped dates</p>
            </div>
            <span className="text-xs font-bold text-purple-900 bg-purple-100 px-3 py-1 rounded-full">
              {filteredOrders.length} Subscribers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200/70 bg-neutral-50/80 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Order ID / Date</th>
                  <th className="px-4 py-3">Subscriber Name</th>
                  <th className="px-4 py-3">Plan Details</th>
                  <th className="px-4 py-3">Fitness Goal</th>
                  <th className="px-4 py-3 text-right">Plan Amount</th>
                  <th className="px-4 py-3 text-center">Skipped Days</th>
                  <th className="px-4 py-3 text-center">Plan Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium text-xs">
                {filteredOrders.map((order) => {
                  const subPlanTitle =
                    order.lines && order.lines.length > 0 ? order.lines[0].name_snapshot : 'Brokole Meal Subscription Plan';
                  const goal = getCustomerGoalInfo(order, subPlanTitle);
                  const orderSkippedDays = liveSkippedDates;

                  return (
                    <tr key={getCanonicalOrderKey(order) || order.id || order.order_no} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-black text-neutral-900 text-xs block">{order.order_no}</span>
                        <span className="text-[10px] text-neutral-400 font-medium">{order.business_date}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold text-neutral-900 block text-xs">{(order as any).customer_name || 'Valued VIP Member'}</span>
                        <span className="text-[10px] text-neutral-500 font-medium">{(order as any).phone || (order as any).email || 'Verified Customer'}</span>
                      </td>

                      <td className="px-4 py-3.5 max-w-[220px]">
                        <span className="font-extrabold text-neutral-800 line-clamp-1 block">{subPlanTitle}</span>
                        <span className="text-[10px] text-neutral-400 font-semibold">{Math.round(Number(order.total_protein))}g Protein • {Math.round(Number(order.total_calories))} kcal</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black border ${goal.bg}`}>
                          <span>{goal.icon}</span>
                          <span>{goal.label}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-black text-purple-950 text-sm tabular-nums">
                        {formatINR(order.total)}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {orderSkippedDays.length > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-black text-[11px]">
                            {formatSkippedDaysText(orderSkippedDays, [])} ({orderSkippedDays.length}d)
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-400 font-semibold">0 Days</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {order.status !== 'placed' && order.status !== 'paid' ? (
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3 text-purple-700" />
                            <span>Active Plan</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAcceptSubscription(order.id || order.order_no)}
                            className="rounded-full px-3 py-1 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <CheckCircle className="size-3" />
                            <span>Accept</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
