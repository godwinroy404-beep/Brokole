import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@brokole/domain';
import { api, isApiConfigured } from '../lib/api';
import type { AdminSession } from '../lib/useSession';

/**
 * Sales history and report.
 *
 * Chart decisions, deliberately:
 *  - The four headline figures are a KPI row of stat tiles, not a bar chart.
 *    Four unrelated magnitudes on one axis would be unreadable.
 *  - Daily revenue is ONE series, so it uses a sequential single hue and needs
 *    no legend - the heading says what is plotted.
 *  - That hue is blue, not the console's emerald, because green already means
 *    "delivered / live" here. Reusing a status colour for a data series is how
 *    a chart starts lying about state.
 *  - Only the best day is direct-labelled; the rest is carried by the hover
 *    tooltip and the table underneath.
 */

const SERIES = '#2a78d6';        // validated: contrast >= 3:1 on this surface
const SERIES_SOFT = '#d7e6f8';

interface Summary {
  orders_total: number | string;
  orders_delivered: number | string;
  orders_cancelled: number | string;
  orders_refunded: number | string;
  net_sales: string | number;
  gst_collected: string | number;
  delivery_fees: string | number;
  gross_revenue: string | number;
  refunded_value: string | number;
  average_order_value: string | number;
}

interface DailyRow { day: string; orders: number | string; delivered: number | string; revenue: string | number }

interface SalesOrder {
  id: string; order_no: string; status: string; business_date: string;
  subtotal: string | number; tax_amount: string | number; delivery_fee: string | number;
  total: string | number; customer_name: string | null; customer_email: string | null;
  delivered_at: string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_STYLE: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-neutral-200 text-neutral-700',
  refunded:  'bg-rose-100 text-rose-800',
};

export function SalesScreen({ session }: { session: AdminSession }) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  const from = useMemo(() => isoDaysAgo(days), [days]);
  const to = useMemo(() => today(), []);

  const load = useCallback(async () => {
    if (!isApiConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.get<{ summary: Summary; daily: DailyRow[]; orders: SalesOrder[] }>(
        `/admin/sales?from=${from}&to=${to}`,
      );
      setSummary(data.summary);
      setDaily(data.daily);
      setOrders(data.orders);
    } catch (e) {
      toast.error('Could not load the sales report', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  function exportCsv() {
    const header = ['Order', 'Business date', 'Status', 'Customer', 'Subtotal', 'GST', 'Delivery', 'Total'];
    const rows = orders.map((o) => [
      o.order_no, o.business_date, o.status,
      (o.customer_name ?? o.customer_email ?? '').replace(/[",]/g, ' '),
      num(o.subtotal), num(o.tax_amount), num(o.delivery_fee), num(o.total),
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `brokole-sales-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Loading sales…</div>;
  }

  const maxRevenue = Math.max(1, ...daily.map((d) => num(d.revenue)));
  const bestDay = daily.reduce<DailyRow | null>(
    (best, d) => (!best || num(d.revenue) > num(best.revenue) ? d : best), null,
  );

  const tiles = [
    { label: 'Gross revenue', value: formatINR(summary?.gross_revenue), hint: 'delivered orders only' },
    { label: 'Orders delivered', value: String(num(summary?.orders_delivered)), hint: `${num(summary?.orders_total)} placed in total` },
    { label: 'Average order', value: formatINR(summary?.average_order_value), hint: 'per delivered order' },
    { label: 'GST collected', value: formatINR(summary?.gst_collected), hint: '5% on food supply' },
  ];

  return (
    <div className="space-y-5">
      {/* filters in one row above everything */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Sales</h2>
          <p className="text-xs text-neutral-500">{from} to {to} · by business date</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  days === r.days ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={exportCsv}
            disabled={orders.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* KPI row - four headline numbers, not a chart */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-medium text-neutral-500">{t.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</div>
            <div className="mt-0.5 text-[11px] text-neutral-400">{t.hint}</div>
          </div>
        ))}
      </div>

      {(num(summary?.orders_cancelled) > 0 || num(summary?.orders_refunded) > 0) && (
        <p className="text-xs text-neutral-500">
          Excluded from revenue: {num(summary?.orders_cancelled)} cancelled,{' '}
          {num(summary?.orders_refunded)} refunded ({formatINR(summary?.refunded_value)} returned).
        </p>
      )}

      {/* daily revenue - one series, one hue, no legend needed */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <TrendingUp className="size-4 text-neutral-400" />
          <h3 className="text-sm font-medium">Revenue per day</h3>
        </div>
        <p className="mb-4 text-xs text-neutral-500">Delivered orders, by business date</p>

        {daily.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">No sales in this period yet.</p>
        ) : (
          <div className="flex h-44 items-end gap-[2px] overflow-x-auto">
            {daily.map((d, i) => {
              const value = num(d.revenue);
              const pct = (value / maxRevenue) * 100;
              const isBest = bestDay?.day === d.day && value > 0;

              return (
                <div
                  key={d.day}
                  className="group relative flex min-w-[10px] flex-1 flex-col items-center justify-end"
                  style={{ height: '100%' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* selective direct label: only the best day */}
                  {isBest && (
                    <span className="mb-1 whitespace-nowrap text-[10px] font-medium text-neutral-600">
                      {formatINR(value)}
                    </span>
                  )}

                  <div
                    className="w-full max-w-[24px] rounded-t transition-colors"
                    style={{
                      height: `${Math.max(pct, value > 0 ? 2 : 0)}%`,
                      background: hover === i ? SERIES : value > 0 ? SERIES : SERIES_SOFT,
                      opacity: hover === null || hover === i ? 1 : 0.55,
                    }}
                  />

                  {hover === i && (
                    <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1 text-[11px] text-white shadow-lg">
                      <div className="font-medium">{d.day}</div>
                      <div>{formatINR(value)} · {num(d.delivered)} delivered</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* sales history - also the table view the chart needs */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Subtotal</th>
              <th className="px-4 py-2.5 text-right font-medium">GST</th>
              <th className="px-4 py-2.5 text-right font-medium">Delivery</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-400">
                No completed orders in this period.
              </td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5 font-mono text-xs">{o.order_no}</td>
                <td className="px-4 py-2.5 text-neutral-600">{o.business_date}</td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {session.can('customers.read') ? (o.customer_name ?? o.customer_email ?? '-') : '-'}
                </td>
                <td className="px-4 py-2.5">
                  {/* status is a labelled chip, never colour alone */}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[o.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(o.subtotal)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{formatINR(o.tax_amount)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{formatINR(o.delivery_fee)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatINR(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
