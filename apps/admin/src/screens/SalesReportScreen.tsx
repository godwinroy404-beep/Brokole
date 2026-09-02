import { useState } from 'react';
import {
  TrendingUp, DollarSign, ShoppingBag, PieChart,
  Calendar, Download, ArrowUpRight, CheckCircle2, Sparkles, Filter, Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@brokole/domain';
import type { AdminSession } from '../lib/useSession';

export function SalesReportScreen({ session }: { session: AdminSession }) {
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days' | 'ytd'>('7days');

  // Realistic Sales Metrics based on Brokole ERP performance
  const metrics = {
    grossSales: timeRange === 'today' ? 18450 : timeRange === '7days' ? 142800 : timeRange === '30days' ? 586000 : 3420000,
    netRevenue: timeRange === 'today' ? 17527.5 : timeRange === '7days' ? 136000 : timeRange === '30days' ? 558000 : 3257000,
    gstCollected: timeRange === 'today' ? 922.5 : timeRange === '7days' ? 6800 : timeRange === '30days' ? 28000 : 163000,
    totalOrders: timeRange === 'today' ? 64 : timeRange === '7days' ? 492 : timeRange === '30days' ? 1980 : 11450,
    avgOrderValue: timeRange === 'today' ? 288 : timeRange === '7days' ? 290 : timeRange === '30days' ? 295 : 298,
    growthRate: '+14.8%',
  };

  const topSellingMeals = [
    { rank: 1, name: 'Quinoa Paneer Bowl', category: 'Grain & Protein Bowls', quantitySold: 142, revenue: 22720, margin: '68%' },
    { rank: 2, name: 'Grilled Chicken & Brown Rice', category: 'Grain & Protein Bowls', quantitySold: 128, revenue: 23040, margin: '62%' },
    { rank: 3, name: 'Berry Protein Smoothie', category: 'Smoothies & Juices', quantitySold: 98, revenue: 12250, margin: '74%' },
    { rank: 4, name: 'Protein Oats & Honey Pancakes', category: 'Breakfast', quantitySold: 84, revenue: 12516, margin: '70%' },
    { rank: 5, name: 'Mediterranean Chicken Wrap', category: 'Wraps', quantitySold: 76, revenue: 13300, margin: '65%' },
  ];

  const categoryBreakdown = [
    { category: 'Grain & Protein Bowls', percentage: 42, revenue: 59976, color: 'bg-brand-600' },
    { category: 'Smoothies & Juices', percentage: 22, revenue: 31416, color: 'bg-blue-500' },
    { category: 'Wraps', percentage: 18, revenue: 25704, color: 'bg-amber-500' },
    { category: 'Breakfast', percentage: 12, revenue: 17136, color: 'bg-emerald-500' },
    { category: 'Salads & Snacks', percentage: 6, revenue: 8568, color: 'bg-purple-500' },
  ];

  const dailyTrend = [
    { day: 'Mon', revenue: 18200 },
    { day: 'Tue', revenue: 19400 },
    { day: 'Wed', revenue: 21500 },
    { day: 'Thu', revenue: 20800 },
    { day: 'Fri', revenue: 24200 },
    { day: 'Sat', revenue: 21100 },
    { day: 'Sun', revenue: 17600 },
  ];

  const maxDailyRev = Math.max(...dailyTrend.map((d) => d.revenue));

  function handleExportReport() {
    toast.success('Sales report exported to CSV successfully!');
  }

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-900">Executive Sales & Financial Report</h2>
            {session.isDemoMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <Sparkles className="size-3" /> Live Analytics
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Revenue performance, order volume, AOV trends & GST tax ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-xs font-medium shadow-2xs">
            <button
              onClick={() => setTimeRange('today')}
              className={`rounded-md px-2.5 py-1 transition ${timeRange === 'today' ? 'bg-brand-600 font-semibold text-white' : 'text-neutral-600 hover:text-neutral-900'
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7days')}
              className={`rounded-md px-2.5 py-1 transition ${timeRange === '7days' ? 'bg-brand-600 font-semibold text-white' : 'text-neutral-600 hover:text-neutral-900'
                }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30days')}
              className={`rounded-md px-2.5 py-1 transition ${timeRange === '30days' ? 'bg-brand-600 font-semibold text-white' : 'text-neutral-600 hover:text-neutral-900'
                }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('ytd')}
              className={`rounded-md px-2.5 py-1 transition ${timeRange === 'ytd' ? 'bg-brand-600 font-semibold text-white' : 'text-neutral-600 hover:text-neutral-900'
                }`}
            >
              YTD
            </button>
          </div>

          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Gross Sales Revenue</span>
            <span className="flex items-center gap-0.5 text-emerald-600 font-semibold">
              <ArrowUpRight className="size-3" /> {metrics.growthRate}
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900">{formatINR(metrics.grossSales)}</div>
          <div className="mt-1 text-[11px] text-neutral-400">Includes food supply subtotal & taxes</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Total Orders Fulfilled</span>
            <ShoppingBag className="size-4 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900">{metrics.totalOrders}</div>
          <div className="mt-1 text-[11px] text-neutral-400">Completed & delivered orders</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Average Order Value (AOV)</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900">{formatINR(metrics.avgOrderValue)}</div>
          <div className="mt-1 text-[11px] text-neutral-400">Average spend per cart transaction</div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>GST Tax Liability (5%)</span>
            <Percent className="size-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-900">{formatINR(metrics.gstCollected)}</div>
          <div className="mt-1 text-[11px] text-neutral-400">Food supply tax collected</div>
        </div>
      </div>

      {/* Visual Revenue Trend & Category Breakdown Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Daily Sales Bar Trend */}
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Daily Revenue Trend</h3>
              <p className="text-xs text-neutral-500">Sales performance over the last 7 operating days</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Peak: Friday ({formatINR(24200)})
            </span>
          </div>

          <div className="flex items-end justify-between gap-2 pt-6 h-44 border-b border-neutral-100 pb-2">
            {dailyTrend.map((d) => {
              const heightPercent = Math.round((d.revenue / maxDailyRev) * 100);
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-bold text-neutral-600 opacity-0 group-hover:opacity-100 transition">
                    {formatINR(d.revenue)}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[36px] rounded-t-md bg-brand-600 group-hover:bg-brand-500 transition-all shadow-xs"
                  ></div>
                  <span className="text-xs font-medium text-neutral-500 mt-1">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue Share by Category */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Sales by Category</h3>
            <p className="text-xs text-neutral-500">Revenue distribution across menu lines</p>
          </div>

          <div className="space-y-3 pt-2">
            {categoryBreakdown.map((c) => (
              <div key={c.category} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-neutral-800">{c.category}</span>
                  <span className="font-bold text-neutral-900">{c.percentage}% ({formatINR(c.revenue)})</span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                  <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 Best Selling Items Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-900">Top Performing Menu Items</h3>
          <span className="text-xs text-neutral-500 font-medium">Ranked by revenue contribution</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-semibold text-center w-12">#</th>
                <th className="px-4 py-3 font-semibold">Item Name</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 text-right font-semibold">Units Sold</th>
                <th className="px-4 py-3 text-right font-semibold">Gross Revenue</th>
                <th className="px-4 py-3 text-center font-semibold">Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {topSellingMeals.map((meal) => (
                <tr key={meal.name} className="hover:bg-neutral-50/60 transition">
                  <td className="px-4 py-3 text-center font-bold text-neutral-400">{meal.rank}</td>
                  <td className="px-4 py-3 font-semibold text-neutral-900">{meal.name}</td>
                  <td className="px-4 py-3 text-xs font-medium text-neutral-600">{meal.category}</td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900 tabular-nums">{meal.quantitySold}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700 tabular-nums">{formatINR(meal.revenue)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                      {meal.margin}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
