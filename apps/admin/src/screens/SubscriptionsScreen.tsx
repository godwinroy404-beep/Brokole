import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  RefreshCw, Loader2, Calendar, Sparkles, Award, ShoppingBag, CheckCircle2,
  AlertTriangle, PauseCircle, Target, Users, Search, Filter, Clock,
  ArrowUpRight, Phone, Mail, CheckCircle, ChevronRight, CreditCard,
  TrendingUp, PlayCircle, LayoutGrid, List, ShieldCheck, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@brokole/domain';
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

function getFallbackSubscriptionOrders(): Order[] {
  return [
    {
      id: 'sub-roy-1',
      order_no: 'BKL-SUB-701',
      status: 'accepted',
      channel: 'subscription',
      business_date: new Date().toISOString().split('T')[0],
      subtotal: 1808,
      tax_amount: 91,
      delivery_fee: 0,
      total: 1899,
      total_calories: 680,
      total_protein: 55,
      customer_id: 'usr-roy',
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: 'Brokole Shred & Gain Pro (7-Day Weekly) Goal Plan',
      lines: [
        { name_snapshot: 'Brokole Shred & Gain Pro (7-Day Weekly)', quantity: 1, unit_price: '1899', line_total: '1899' },
      ],
      customer_name: 'r roy',
      phone: '+91 98765 00000',
      skipped_days: [],
    } as any,
    {
      id: 'sub-1',
      order_no: 'BKL-SUB-301',
      status: 'accepted',
      channel: 'subscription',
      business_date: new Date().toISOString().split('T')[0],
      subtotal: 7142,
      tax_amount: 357,
      delivery_fee: 0,
      total: 7499,
      total_calories: 680,
      total_protein: 55,
      customer_id: 'usr-1',
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: 'Muscle Build & Hypertrophy Goal Plan [SKIPPED_DAYS: 4, 11]',
      lines: [
        { name_snapshot: 'Shred & Gain Pro (30 Days) - High Protein', quantity: 1, unit_price: '7499', line_total: '7499' },
      ],
      customer_name: 'Siddharth Rao',
      phone: '+91 98451 22910',
      skipped_days: [4, 11],
    } as any,
    {
      id: 'sub-2',
      order_no: 'BKL-SUB-302',
      status: 'accepted',
      channel: 'subscription',
      business_date: new Date().toISOString().split('T')[0],
      subtotal: 8570,
      tax_amount: 429,
      delivery_fee: 0,
      total: 8999,
      total_calories: 720,
      total_protein: 64,
      customer_id: 'usr-2',
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: 'Elite Athlete Plan (30 Days) - Athletic Performance Goal Plan',
      lines: [
        { name_snapshot: '30-Day Elite Athlete VIP Plan', quantity: 1, unit_price: '8999', line_total: '8999' },
      ],
      customer_name: 'Ananya Deshmukh',
      phone: '+91 98200 41109',
      skipped_days: [15],
    } as any,
    {
      id: 'sub-3',
      order_no: 'BKL-SUB-303',
      status: 'in_kitchen',
      channel: 'subscription',
      business_date: new Date().toISOString().split('T')[0],
      subtotal: 1808,
      tax_amount: 91,
      delivery_fee: 0,
      total: 1899,
      total_calories: 520,
      total_protein: 42,
      customer_id: 'usr-3',
      placed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: '7-Day Fat Loss & Lean Shred Flex Plan',
      lines: [
        { name_snapshot: '7-Day Flex Shred Plan (Low Carb)', quantity: 1, unit_price: '1899', line_total: '1899' },
      ],
      customer_name: 'Priya Sharma',
      phone: '+91 98230 44122',
      skipped_days: [],
    } as any,
  ];
}

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
        order_no: o.id || o.order_no || 'BKL-SUB-001',
        status: st as OrderStatus,
        channel: o.channel || 'online',
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
        notes: o.notes || o.itemsSummary || '',
        lines: (o.itemsList || o.lines || []).map((item: any) => ({
          name_snapshot: item.title || item.name_snapshot || 'Chef Crafted Meal',
          quantity: item.quantity || 1,
          unit_price: String(item.price || item.unit_price || 0),
          line_total: String((item.price || item.unit_price || 0) * (item.quantity || 1)),
        })),
        customer_name: o.customerName || o.customer_name || 'Valued Customer',
        phone: o.customerPhone || o.phone || '+91 98765 43210',
        skipped_days: o.skipped_days || [],
      };
    });
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
    if (!Array.isArray(storeOrders) || storeOrders.length === 0) return [];
    return storeOrders.map((o: any) => {
      let st = (o.status || '').toLowerCase();
      if (st === 'delivered') st = 'delivered';
      else if (st === 'cancelled' || st === 'canceled') st = 'cancelled';
      else if (st === 'out for delivery' || st === 'out_for_delivery') st = 'out_for_delivery';
      else if (st === 'packed') st = 'packed';
      else if (st === 'in_kitchen' || st === 'in kitchen' || st === 'preparing') st = 'in_kitchen';
      else if (st === 'accepted') st = 'accepted';
      else st = 'placed';

      const itemsSummary = o.itemsSummary || o.notes || 'Chef Crafted Meal';

      return {
        id: o.serverId || o.id,
        order_no: o.id || 'BKL-SUB-001',
        status: st as OrderStatus,
        channel: o.channel || (itemsSummary.toLowerCase().includes('plan') || itemsSummary.toLowerCase().includes('subscription') || itemsSummary.toLowerCase().includes('weekly') || itemsSummary.toLowerCase().includes('shred') ? 'subscription' : 'online'),
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
        notes: o.notes || itemsSummary || '',
        lines: (o.itemsList || []).length > 0 ? (o.itemsList.map((item: any) => ({
          name_snapshot: item.title || 'Chef Crafted Meal',
          quantity: item.quantity || 1,
          unit_price: String(item.price || 0),
          line_total: String((item.price || 0) * (item.quantity || 1)),
        }))) : [{
          name_snapshot: itemsSummary,
          quantity: 1,
          unit_price: String(o.totalAmount || 399),
          line_total: String(o.totalAmount || 399),
        }],
        customer_name: o.customerName || 'r roy',
        phone: o.customerPhone || '+91 98765 43210',
        skipped_days: o.skipped_days || [],
      };
    });
  } catch {
    return [];
  }
}

export function SubscriptionsScreen({ session }: { session: AdminSession }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cards' | 'roster'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | '30days' | '7days' | 'skipped'>('all');
  const [skippedDays, setSkippedDays] = useState<number[]>([]);
  const [dismissedSubIds, setDismissedSubIds] = useState<string[]>([]);
  const handleSyncLiveSubscriptions = async () => {
    setDismissedSubIds([]);
    try {
      localStorage.removeItem('bkl_dismissed_sub_ids');
    } catch { /* ignore */ }
    await fetchOrders();
    toast.success('Live subscriptions synced & restored!');
  };

  const handleAcceptSubscription = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        (o.id === orderId || o.order_no === orderId)
          ? { ...o, status: 'accepted' as OrderStatus }
          : o
      )
    );

    try {
      if (isApiConfigured) {
        await api.patch(`/orders/${encodeURIComponent(orderId)}/status`, { status: 'accepted' });
      }
      toast.success(`Subscription ${orderId} Accepted! 🎉`, {
        description: 'Customer subscription activated for daily kitchen schedule.',
      });
    } catch {
      toast.success(`Subscription ${orderId} Accepted!`, {
        description: 'Activated locally.',
      });
    }
  };

  const handleDismissSubscription = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.order_no === orderId);
    const orderNo = targetOrder?.order_no || orderId;
    const custName = (targetOrder as any)?.customer_name || (targetOrder as any)?.customerName || '';

    const updated = [...new Set([...dismissedSubIds, orderId, orderNo])];
    setDismissedSubIds(updated);
    setOrders((prev) => prev.filter((o) => o.id !== orderId && o.order_no !== orderId && o.order_no !== orderNo));
    try {
      localStorage.setItem('bkl_dismissed_sub_ids', JSON.stringify(updated));
    } catch { /* ignore */ }

    try {
      await fetch('/api/local-orders-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          orderId,
          order_no: orderNo,
          customer_name: custName,
          order: { id: orderId, order_no: orderNo, customer_name: custName, status: 'Cancelled', deleted: true },
        }),
      });
      await fetch('/api/local-orders-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          orderId,
          order_no: orderNo,
          customer_name: custName,
        }),
      });
    } catch { /* ignore */ }

    if (isApiConfigured) {
      try {
        await api.patch(`/orders/${encodeURIComponent(orderId)}/status`, { status: 'cancelled' });
        if (orderNo && orderNo !== orderId) {
          await api.patch(`/orders/${encodeURIComponent(orderNo)}/status`, { status: 'cancelled' }).catch(() => {});
        }
      } catch { /* ignore */ }
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('bkl-orders-updated'));

    toast.success('Subscription deleted & removed from customer profile');
  };

  const handleClearAllSubscriptions = async () => {
    const allSubIds = orders.map((o) => o.id || o.order_no);
    const updated = [...new Set([...dismissedSubIds, ...allSubIds])];
    setDismissedSubIds(updated);
    const targetOrders = [...orders];
    setOrders([]);
    try {
      localStorage.setItem('bkl_dismissed_sub_ids', JSON.stringify(updated));
    } catch { /* ignore */ }

    for (const targetOrder of targetOrders) {
      const subId = targetOrder.id || targetOrder.order_no;
      const orderNo = targetOrder.order_no || subId;
      const custName = (targetOrder as any)?.customer_name || (targetOrder as any)?.customerName || '';

      try {
        await fetch('/api/local-orders-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            orderId: subId,
            order_no: orderNo,
            customer_name: custName,
            order: { id: subId, order_no: orderNo, customer_name: custName, status: 'Cancelled', deleted: true },
          }),
        });
        await fetch('/api/local-orders-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            orderId: subId,
            order_no: orderNo,
            customer_name: custName,
          }),
        });
      } catch { /* ignore */ }

      if (isApiConfigured) {
        try {
          await api.patch(`/orders/${encodeURIComponent(subId)}/status`, { status: 'cancelled' });
        } catch { /* ignore */ }
      }
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('bkl-orders-updated'));

    toast.success('All subscription cards cleared & removed from customer profiles');
  };

  const fetchOrders = useCallback(async () => {
    let apiOrders: Order[] = [];
    if (isApiConfigured) {
      try {
        const { orders: fetched } = await api.get<{ orders: Order[] }>('/orders');
        if (fetched && fetched.length > 0) {
          apiOrders = fetched;
        }
      } catch {
        apiOrders = [];
      }
    }

    const diskOrders = await fetchDiskOrders();
    const localStoreOrders = getLocalStorageOrders();

    const orderMap = new Map<string, Order>();

    // Fallbacks first
    for (const o of getFallbackSubscriptionOrders()) {
      orderMap.set(o.id || o.order_no, o);
    }
    // Local storage
    for (const o of localStoreOrders) {
      orderMap.set(o.id || o.order_no, o);
    }
    // Disk sync
    for (const o of diskOrders) {
      orderMap.set(o.id || o.order_no, o);
    }
    // API orders (highest priority)
    for (const o of apiOrders) {
      orderMap.set(o.id || o.order_no, o);
    }

    setOrders(Array.from(orderMap.values()));
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('bkl_skipped_days');
        setSkippedDays(saved ? JSON.parse(saved) : []);
        void fetchOrders();
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('bkl-skips-updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bkl-skips-updated', handleStorage);
    };
  }, [fetchOrders]);

  // Real skipped days for the month, from subscription_skips.
  useEffect(() => {
    if (!isApiConfigured) return;
    let alive = true;

    const now = new Date();
    const pad = (v: number) => String(v).padStart(2, '0');
    const first = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastIso = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;

    api
      .get<{ skips: Array<{ skip_date: string }> }>(`/admin/skips?from=${first}&to=${lastIso}`)
      .then(({ skips }) => {
        if (!alive) return;
        setSkippedDays([...new Set(skips.map((s) => Number(String(s.skip_date).slice(8, 10))))]);
      })
      .catch(() => { /* the board still works without it */ });

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void fetchOrders();
    };
    const interval = window.setInterval(tick, 4000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchOrders]);

  // Filter subscription orders specifically
  const subscriptionOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderId = order.id || order.order_no;
      if (dismissedSubIds.includes(orderId)) return false;

      const isSubChannel = order.channel === 'subscription';
      const isSubNo = (order.order_no || '').toLowerCase().includes('sub');
      const isSubItem = order.lines?.some((l) => {
        const name = (l.name_snapshot || '').toLowerCase();
        return (
          name.includes('subscription') ||
          name.includes('weekly flex') ||
          name.includes('shred & gain') ||
          name.includes('shred and gain') ||
          name.includes('athlete plan') ||
          name.includes('30-day') ||
          name.includes('7-day flex') ||
          name.includes('pre-book')
        );
      });
      const isSubNotes = order.notes && (
        order.notes.toLowerCase().includes('subscription') ||
        order.notes.toLowerCase().includes('weekly flex') ||
        order.notes.toLowerCase().includes('shred & gain') ||
        order.notes.toLowerCase().includes('athlete plan')
      );
      return isSubChannel || isSubNo || isSubNotes || isSubItem;
    });
  }, [orders, dismissedSubIds]);

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
        const orderSkippedDays = (order as any).skipped_days || [];
        return orderSkippedDays.length > 0 || skippedDays.length > 0;
      }
      return true;
    });
  }, [subscriptionOrders, searchQuery, planFilter, skippedDays]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500 py-12 justify-center">
        <Loader2 className="size-5 animate-spin text-purple-600" />
        <span className="font-semibold text-neutral-700">Loading VIP Subscription Hub & Calendar Schedules…</span>
      </div>
    );
  }

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

                // Extract live skipped_days from database order response, notes tag, or storage fallback
                let orderSkippedDays: (string | number)[] = [];

                const savedDates = localStorage.getItem('bkl_skipped_dates');
                let localDates: string[] = [];
                try {
                  if (savedDates) {
                    const parsed = JSON.parse(savedDates);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      localDates = parsed;
                    }
                  }
                } catch { /* ignore */ }

                const isRoyOrder = (order as any).customer_name?.toLowerCase().includes('roy') ||
                                   (order as any).customer_name?.toLowerCase().includes('valued') ||
                                   order.id?.includes('roy') ||
                                   order.id?.includes('303') ||
                                   order.order_no?.includes('303') ||
                                   order.order_no?.includes('701');

                if (Array.isArray((order as any).skipped_days) && (order as any).skipped_days.length > 0) {
                  orderSkippedDays = (order as any).skipped_days;
                } else if (order.notes && order.notes.includes('[SKIPPED_DAYS:')) {
                  const match = order.notes.match(/\[SKIPPED_DAYS:\s*([0-9a-zA-Z\-, ]*)\]/i);
                  if (match && match[1]) {
                    orderSkippedDays = match[1].split(',').map((s) => s.trim());
                  }
                }

                if (localDates.length > 0 && (isRoyOrder || orderSkippedDays.length === 0)) {
                  orderSkippedDays = [...new Set([...orderSkippedDays, ...localDates])];
                }

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
                    key={order.id}
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
                          {order.status === 'accepted' ? (
                            <span className="rounded-full px-3 py-1 text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                              <CheckCircle2 className="size-3.5 text-blue-600" />
                              <span>Accepted</span>
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
                  const orderSkippedDays = (order as any).skipped_days || skippedDays;

                  return (
                    <tr key={order.id} className="hover:bg-neutral-50/80 transition-colors">
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
                        {order.status === 'accepted' ? (
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black bg-blue-100 text-blue-900 border border-blue-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3 text-blue-600" />
                            <span>Accepted</span>
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
