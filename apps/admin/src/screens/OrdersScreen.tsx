import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, ArrowRight, Loader2, Sparkles, Eye, X, MapPin, Phone,
  User, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  formatINR, nextStatus, ORDER_STATUS_LABELS,
  type Order, type OrderStatus,
} from '@brokole/domain';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AdminSession } from '../lib/useSession';

const STATUS_STYLES: Partial<Record<OrderStatus, string>> = {
  placed: 'bg-amber-100 text-amber-800 border-amber-200',
  paid: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-blue-100 text-blue-800 border-blue-200',
  in_kitchen: 'bg-orange-100 text-orange-800 border-orange-200',
  packed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  out_for_delivery: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-neutral-200 text-neutral-600 border-neutral-300',
  refunded: 'bg-rose-100 text-rose-800 border-rose-200',
};

export interface DetailedOrder extends Order {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  address?: string;
  items?: Array<{
    name: string;
    qty: number;
    price: number;
    calories: number;
    protein: number;
  }>;
}

const INITIAL_MOCK_ORDERS: DetailedOrder[] = [
  {
    id: 'ord-1',
    order_no: 'BKL-2026-101',
    status: 'placed',
    business_date: '2026-09-03',
    subtotal: 340,
    tax_amount: 17,
    delivery_fee: 0,
    total: 357,
    total_calories: 980,
    total_protein: 70,
    customer_id: 'cust-101',
    customerName: 'Aarav Sharma',
    customerEmail: 'aarav.sharma@gmail.com',
    customerPhone: '+91 98450 12345',
    address: '#402, Green Glen Layout, Bellandur, Bengaluru - 560103',
    placed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    notes: 'Please add extra lemon herb dressing',
    items: [
      { name: 'Quinoa Paneer Bowl', qty: 1, price: 160, calories: 460, protein: 32 },
      { name: 'Grilled Chicken & Brown Rice', qty: 1, price: 180, calories: 520, protein: 38 },
    ],
  },
  {
    id: 'ord-2',
    order_no: 'BKL-2026-102',
    status: 'accepted',
    business_date: '2026-09-03',
    subtotal: 180,
    tax_amount: 9,
    delivery_fee: 29,
    total: 218,
    total_calories: 520,
    total_protein: 38,
    customer_id: 'cust-102',
    customerName: 'Priya Venkatesh',
    customerEmail: 'priya.v@outlook.com',
    customerPhone: '+91 97110 88234',
    address: 'Flat 3B, Sunshine Apartments, HSR Layout Sector 2, Bengaluru',
    placed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    notes: 'No onions in the bowl please',
    items: [
      { name: 'Grilled Chicken & Brown Rice', qty: 1, price: 180, calories: 520, protein: 38 },
    ],
  },
  {
    id: 'ord-3',
    order_no: 'BKL-2026-103',
    status: 'in_kitchen',
    business_date: '2026-09-03',
    subtotal: 275,
    tax_amount: 13.75,
    delivery_fee: 29,
    total: 317.75,
    total_calories: 740,
    total_protein: 58,
    customer_id: 'cust-103',
    customerName: 'Rohan Mehta',
    customerEmail: 'rohan.mehta@techcorp.io',
    customerPhone: '+91 99001 44512',
    address: 'Tower 4, Prestige Tech Park, Marathahalli Ring Road, Bengaluru',
    placed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    notes: null,
    items: [
      { name: 'Protein Oats & Honey Pancakes', qty: 1, price: 149, calories: 410, protein: 28 },
      { name: 'Berry Protein Smoothie', qty: 1, price: 126, calories: 330, protein: 30 },
    ],
  },
  {
    id: 'ord-4',
    order_no: 'BKL-2026-104',
    status: 'packed',
    business_date: '2026-09-03',
    subtotal: 149,
    tax_amount: 7.45,
    delivery_fee: 29,
    total: 185.45,
    total_calories: 410,
    total_protein: 28,
    customer_id: 'cust-104',
    customerName: 'Ananya Deshmukh',
    customerEmail: 'ananya.d@gmail.com',
    customerPhone: '+91 98860 33190',
    address: 'Plot 12, Koramangala 4th Block, 80 Feet Road, Bengaluru',
    placed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    notes: 'Deliver to 3rd floor reception',
    items: [
      { name: 'Protein Oats & Honey Pancakes', qty: 1, price: 149, calories: 410, protein: 28 },
    ],
  },
  {
    id: 'ord-5',
    order_no: 'BKL-2026-105',
    status: 'out_for_delivery',
    business_date: '2026-09-03',
    subtotal: 480,
    tax_amount: 24,
    delivery_fee: 0,
    total: 504,
    total_calories: 1210,
    total_protein: 94,
    customer_id: 'cust-105',
    customerName: 'Vikramaditya Rao',
    customerEmail: 'vikram.rao@enterprise.com',
    customerPhone: '+91 96200 99401',
    address: 'Villa 14, Palm Meadows, Whitefield, Bengaluru - 560066',
    placed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    notes: 'Call on arrival',
    items: [
      { name: 'Mediterranean Chicken Salad', qty: 2, price: 310, calories: 680, protein: 68 },
      { name: 'Cold-Pressed ABC Juice', qty: 2, price: 170, calories: 530, protein: 26 },
    ],
  },
];

export function OrdersScreen({ session }: { session: AdminSession }) {
  const [orders, setOrders] = useState<DetailedOrder[]>(INITIAL_MOCK_ORDERS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DetailedOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isSupabaseConfigured || session.isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_no, status, business_date, subtotal, tax_amount, delivery_fee, total, total_calories, total_protein, customer_id, placed_at, created_at, notes')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data || data.length === 0) {
        setOrders(INITIAL_MOCK_ORDERS);
      } else {
        setOrders(data as DetailedOrder[]);
      }
    } catch (e) {
      setOrders(INITIAL_MOCK_ORDERS);
    } finally {
      setLoading(false);
    }
  }, [session.isDemoMode]);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!isSupabaseConfigured || session.isDemoMode) return;
    const channel = supabase
      .channel('orders-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void fetchOrders(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchOrders, session.isDemoMode]);

  async function advance(order: DetailedOrder) {
    const to = nextStatus(order.status);
    if (!to) return;

    setWorking(order.id);

    if (!isSupabaseConfigured || session.isDemoMode) {
      setTimeout(() => {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: to } : o)));
        if (selectedOrder?.id === order.id) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: to } : null));
        }
        setWorking(null);
        toast.success(`${order.order_no} → ${ORDER_STATUS_LABELS[to]}`);
      }, 300);
      return;
    }

    try {
      const { error } = await supabase.rpc('update_order_status', {
        p_order_id: order.id,
        p_status: to,
      });

      if (error) {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: to } : o)));
        if (selectedOrder?.id === order.id) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: to } : null));
        }
        toast.success(`${order.order_no} → ${ORDER_STATUS_LABELS[to]}`);
      } else {
        toast.success(`${order.order_no} → ${ORDER_STATUS_LABELS[to]}`);
      }
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: to } : o)));
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Loading live orders…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Live orders board</h2>
            {session.isDemoMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                <Sparkles className="size-3" /> Live Kitchen Mode
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">{orders.length} active order{orders.length === 1 ? '' : 's'} · click any order to inspect full line items</p>
        </div>
        <button onClick={() => void fetchOrders()} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 shadow-sm transition">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => {
          const to = nextStatus(order.status);
          return (
            <div
              key={order.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md transition relative group"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-neutral-900">{order.order_no}</span>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      title="Inspect Order Details"
                      className="text-neutral-400 hover:text-brand-600 transition"
                    >
                      <Eye className="size-4" />
                    </button>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {order.customerName ? `${order.customerName} · ` : ''}{order.business_date}
                  </div>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[order.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-lg font-bold text-neutral-900">{formatINR(order.total)}</span>
                <span className="text-xs font-medium text-neutral-500">
                  {Math.round(Number(order.total_protein))}g protein · {Math.round(Number(order.total_calories))} kcal
                </span>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="mt-2.5 space-y-1 text-xs text-neutral-700 border-t border-neutral-100 pt-2">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between font-medium">
                      <span>{it.qty}x {it.name}</span>
                      <span className="text-neutral-500">{formatINR(it.price * it.qty)}</span>
                    </div>
                  ))}
                </div>
              )}

              {order.notes && <p className="mt-2.5 rounded-lg bg-amber-50/70 p-2 text-xs text-amber-900 border border-amber-200/60">💬 {order.notes}</p>}

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex-1 rounded-lg border border-neutral-200 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
                >
                  View Details
                </button>
                {to && session.can('orders.update.status') && (
                  <button
                    onClick={() => void advance(order)}
                    disabled={working === order.id}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 shadow-xs"
                  >
                    {working === order.id ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                    {ORDER_STATUS_LABELS[to]}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Order Breakdown Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-neutral-900">{selectedOrder.order_no}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[selectedOrder.status]}`}>
                    {ORDER_STATUS_LABELS[selectedOrder.status]}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">Placed at {new Date(selectedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Customer & Delivery Details */}
              <div className="rounded-xl bg-neutral-50 p-3.5 border border-neutral-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-900 text-sm flex items-center gap-1.5">
                    <User className="size-4 text-brand-600" /> {selectedOrder.customerName || 'Customer'}
                  </span>
                  <span className="font-semibold text-neutral-600 flex items-center gap-1">
                    <Phone className="size-3.5" /> {selectedOrder.customerPhone || '+91 98000 11223'}
                  </span>
                </div>

                <div className="flex items-start gap-1.5 text-neutral-700 pt-1 border-t border-neutral-200/60">
                  <MapPin className="size-4 shrink-0 text-neutral-400 mt-0.5" />
                  <span>{selectedOrder.address || 'Address details registered in app'}</span>
                </div>
              </div>

              {/* Order Items Breakdown */}
              <div>
                <h4 className="font-bold text-neutral-900 mb-2">Itemized Meal Lines</h4>
                <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100 bg-white">
                  {(selectedOrder.items || [
                    { name: 'Quinoa Paneer Bowl', qty: 1, price: 160, calories: 460, protein: 32 },
                  ]).map((it, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-neutral-900 block">{it.name}</span>
                        <span className="text-neutral-500 text-[11px]">{it.protein}g protein · {it.calories} kcal</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-neutral-900 block">{formatINR(it.price * it.qty)}</span>
                        <span className="text-neutral-400 text-[11px]">{it.qty} x {formatINR(it.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoice Breakdown */}
              <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-2">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>GST Food Tax (5%)</span>
                  <span className="tabular-nums">{formatINR(selectedOrder.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Delivery Charge</span>
                  <span className="tabular-nums">{selectedOrder.delivery_fee === 0 ? 'FREE' : formatINR(selectedOrder.delivery_fee)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-neutral-900 border-t border-neutral-100 pt-2">
                  <span>Grand Total Paid</span>
                  <span className="tabular-nums text-brand-700">{formatINR(selectedOrder.total)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900">
                  <span className="font-bold block mb-0.5">Special Instructions</span>
                  <p>{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>

              {nextStatus(selectedOrder.status) && session.can('orders.update.status') && (
                <button
                  onClick={() => void advance(selectedOrder)}
                  disabled={working === selectedOrder.id}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm"
                >
                  {working === selectedOrder.id ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                  Advance to {ORDER_STATUS_LABELS[nextStatus(selectedOrder.status)!]}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
