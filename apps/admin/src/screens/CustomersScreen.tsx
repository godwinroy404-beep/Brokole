import { useState } from 'react';
import { Users, Search, Phone, Mail, MapPin, ShoppingBag, Calendar, ArrowUpRight, X, Sparkles } from 'lucide-react';
import { formatINR } from '@brokole/domain';
import type { AdminSession } from '../lib/useSession';

export interface CustomerProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  joinedDate: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  address: string;
  preferredCategory: string;
  status: 'Active' | 'VIP' | 'Inactive';
  ordersHistory: Array<{
    id: string;
    orderNo: string;
    date: string;
    total: number;
    itemsCount: number;
    status: string;
  }>;
}

const MOCK_CUSTOMERS: CustomerProfile[] = [
  {
    id: 'cust-101',
    fullName: 'Aarav Sharma',
    email: 'aarav.sharma@gmail.com',
    phone: '+91 98450 12345',
    joinedDate: '2026-01-15',
    totalOrders: 28,
    totalSpent: 5240,
    lastOrderDate: '2026-09-03',
    address: '#402, Green Glen Layout, Bellandur, Bengaluru - 560103',
    preferredCategory: 'Grain & Protein Bowls',
    status: 'VIP',
    ordersHistory: [
      { id: 'o-1', orderNo: 'BKL-2026-101', date: '2026-09-03', total: 357, itemsCount: 2, status: 'placed' },
      { id: 'o-2', orderNo: 'BKL-2026-088', date: '2026-09-01', total: 420, itemsCount: 3, status: 'delivered' },
      { id: 'o-3', orderNo: 'BKL-2026-065', date: '2026-08-28', total: 310, itemsCount: 2, status: 'delivered' },
    ],
  },
  {
    id: 'cust-102',
    fullName: 'Priya Venkatesh',
    email: 'priya.v@outlook.com',
    phone: '+91 97110 88234',
    joinedDate: '2026-03-10',
    totalOrders: 19,
    totalSpent: 3680,
    lastOrderDate: '2026-09-03',
    address: 'Flat 3B, Sunshine Apartments, HSR Layout Sector 2, Bengaluru',
    preferredCategory: 'Smoothies & Juices',
    status: 'VIP',
    ordersHistory: [
      { id: 'o-4', orderNo: 'BKL-2026-102', date: '2026-09-03', total: 218, itemsCount: 1, status: 'accepted' },
      { id: 'o-5', orderNo: 'BKL-2026-092', date: '2026-08-31', total: 290, itemsCount: 2, status: 'delivered' },
    ],
  },
  {
    id: 'cust-103',
    fullName: 'Rohan Mehta',
    email: 'rohan.mehta@techcorp.io',
    phone: '+91 99001 44512',
    joinedDate: '2026-05-22',
    totalOrders: 14,
    totalSpent: 2890,
    lastOrderDate: '2026-09-03',
    address: 'Tower 4, Prestige Tech Park, Marathahalli Ring Road, Bengaluru',
    preferredCategory: 'Grain & Protein Bowls',
    status: 'Active',
    ordersHistory: [
      { id: 'o-6', orderNo: 'BKL-2026-103', date: '2026-09-03', total: 317.75, itemsCount: 2, status: 'in_kitchen' },
    ],
  },
  {
    id: 'cust-104',
    fullName: 'Ananya Deshmukh',
    email: 'ananya.d@gmail.com',
    phone: '+91 98860 33190',
    joinedDate: '2026-06-04',
    totalOrders: 11,
    totalSpent: 1980,
    lastOrderDate: '2026-09-03',
    address: 'Plot 12, Koramangala 4th Block, 80 Feet Road, Bengaluru',
    preferredCategory: 'Breakfast',
    status: 'Active',
    ordersHistory: [
      { id: 'o-7', orderNo: 'BKL-2026-104', date: '2026-09-03', total: 185.45, itemsCount: 1, status: 'packed' },
    ],
  },
  {
    id: 'cust-105',
    fullName: 'Vikramaditya Rao',
    email: 'vikram.rao@enterprise.com',
    phone: '+91 96200 99401',
    joinedDate: '2026-02-18',
    totalOrders: 22,
    totalSpent: 4850,
    lastOrderDate: '2026-09-03',
    address: 'Villa 14, Palm Meadows, Whitefield, Bengaluru - 560066',
    preferredCategory: 'Salads & Bowls',
    status: 'VIP',
    ordersHistory: [
      { id: 'o-8', orderNo: 'BKL-2026-105', date: '2026-09-03', total: 504, itemsCount: 3, status: 'out_for_delivery' },
    ],
  },
  {
    id: 'cust-106',
    fullName: 'Sneha Kapoor',
    email: 'sneha.kapoor@design.co',
    phone: '+91 98199 55120',
    joinedDate: '2026-07-12',
    totalOrders: 6,
    totalSpent: 990,
    lastOrderDate: '2026-08-25',
    address: 'Indiranagar 100ft Road, Stage 2, Bengaluru',
    preferredCategory: 'Wraps',
    status: 'Active',
    ordersHistory: [],
  },
];

export function CustomersScreen({ session }: { session: AdminSession }) {
  const [customers] = useState<CustomerProfile[]>(MOCK_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'VIP' | 'Active' | 'Inactive'>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const vipCount = customers.filter((c) => c.status === 'VIP').length;
  const totalLifetimeRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgSpendPerCustomer = Math.round(totalLifetimeRevenue / (customers.length || 1));

  return (
    <div className="space-y-5">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-900">Customer Directory</h2>
            {session.isDemoMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <Sparkles className="size-3" /> Live Data
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Profiles, lifetime order history, preferred meals & delivery contacts
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Total Registered Customers</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900">{customers.length}</span>
            <Users className="size-5 text-neutral-400" />
          </div>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm">
          <div className="text-xs font-medium text-purple-700">VIP Members (&gt; ₹3,000 Spend)</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-900">{vipCount}</span>
            <span className="rounded-full bg-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-900">
              High Value
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Average Spend Per Customer</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900">{formatINR(avgSpendPerCustomer)}</span>
            <span className="text-xs font-medium text-neutral-400">Lifetime LTV</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, email, or phone..."
            className="w-full rounded-lg border border-neutral-200 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="flex items-center gap-1.5 border border-neutral-200 rounded-lg p-1 bg-neutral-50 text-xs font-medium">
          {(['All', 'VIP', 'Active'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1 transition ${statusFilter === st
                ? 'bg-white font-semibold text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-800'
                }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Preferred Category</th>
              <th className="px-4 py-3 text-center font-semibold">Orders</th>
              <th className="px-4 py-3 text-right font-semibold">Total Spend</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50/60 transition">
                <td className="px-4 py-3">
                  <div className="font-semibold text-neutral-900">{c.fullName}</div>
                  <div className="text-[11px] text-neutral-400">Joined {c.joinedDate}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-1 text-neutral-700 font-medium">
                    <Mail className="size-3 text-neutral-400" /> {c.email}
                  </div>
                  <div className="flex items-center gap-1 text-neutral-500 text-[11px] mt-0.5">
                    <Phone className="size-3 text-neutral-400" /> {c.phone}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-neutral-600">{c.preferredCategory}</td>
                <td className="px-4 py-3 text-center font-bold text-neutral-900 tabular-nums">{c.totalOrders}</td>
                <td className="px-4 py-3 text-right font-bold text-neutral-900 tabular-nums">
                  {formatINR(c.totalSpent)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.status === 'VIP'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setSelectedCustomer(c)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-2xs"
                  >
                    View Details <ArrowUpRight className="size-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-neutral-900">{selectedCustomer.fullName}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedCustomer.status === 'VIP' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                  >
                    {selectedCustomer.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">Customer ID: {selectedCustomer.id}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                <div>
                  <span className="text-neutral-400 block text-[11px]">Email</span>
                  <span className="font-semibold text-neutral-800">{selectedCustomer.email}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Phone</span>
                  <span className="font-semibold text-neutral-800">{selectedCustomer.phone}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Total Spend</span>
                  <span className="font-bold text-brand-700 text-sm">{formatINR(selectedCustomer.totalSpent)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Total Orders</span>
                  <span className="font-bold text-neutral-800 text-sm">{selectedCustomer.totalOrders} orders</span>
                </div>
              </div>

              <div>
                <span className="text-neutral-500 font-semibold block mb-1">Primary Delivery Address</span>
                <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-neutral-700">
                  <MapPin className="size-4 shrink-0 text-brand-600 mt-0.5" />
                  <span>{selectedCustomer.address}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-neutral-900 mb-2 text-xs">Recent Order History</h4>
                <div className="space-y-2">
                  {selectedCustomer.ordersHistory.length > 0 ? (
                    selectedCustomer.ordersHistory.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-2.5 bg-white">
                        <div>
                          <span className="font-mono font-semibold text-neutral-900 block">{o.orderNo}</span>
                          <span className="text-neutral-400 text-[11px]">{o.date} · {o.itemsCount} items</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-neutral-900 block">{formatINR(o.total)}</span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-600">
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-neutral-400 italic">No recent order logs available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
