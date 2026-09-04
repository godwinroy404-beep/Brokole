import { useCallback, useEffect, useState } from 'react';
import {
  Boxes, AlertTriangle, Plus, Search, Filter,
  CheckCircle2, Loader2, RefreshCw, Sparkles, X, XCircle, AlertOctagon,
  Pencil, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@brokole/domain';
import type { AdminSession } from '../lib/useSession';
import { api, isApiConfigured } from '../lib/api';

/** What GET /admin/inventory returns. */
interface ApiIngredient {
  id: string; sku: string; name: string; category: string; unit: string;
  min_threshold: string | number; cost_per_unit: string | number;
  supplier: string | null; on_hand: string | number; last_restocked: string | null;
}

const n = (v: unknown): number => {
  const parsed = typeof v === 'number' ? v : Number.parseFloat(String(v ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

function toItem(r: ApiIngredient): InventoryItem {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    quantity: n(r.on_hand),
    unit: r.unit,
    minThreshold: n(r.min_threshold),
    costPerUnit: n(r.cost_per_unit),
    lastRestocked: (r.last_restocked ?? '').slice(0, 10) || '—',
    supplier: r.supplier ?? '—',
  };
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;   // free text in the database, not a fixed list
  quantity: number;
  unit: string;       // kg, g, l, ml, pcs, pack …
  minThreshold: number;
  costPerUnit: number;
  lastRestocked: string;
  supplier: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Proteins': 'bg-rose-100 text-rose-800 border-rose-200',
  'Grains & Produce': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Dairy & Alternatives': 'bg-blue-100 text-blue-800 border-blue-200',
  'Dressings & Sauces': 'bg-amber-100 text-amber-800 border-amber-200',
  'Packaging': 'bg-purple-100 text-purple-800 border-purple-200',
};

export function InventoryScreen({ session }: { session: AdminSession }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured) { setLoading(false); return; }
    try {
      const { items: rows } = await api.get<{ items: ApiIngredient[] }>('/admin/inventory');
      setItems(rows.map(toItem));
    } catch (e) {
      toast.error('Could not load inventory', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit and Delete Item States
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  // New Item Form State
  const [newItem, setNewItem] = useState<{
    name: string;
    sku: string;
    category: InventoryItem['category'];
    quantity: number;
    unit: InventoryItem['unit'];
    minThreshold: number;
    costPerUnit: number;
    supplier: string;
  }>({
    name: '',
    sku: '',
    category: 'Proteins',
    quantity: 10,
    unit: 'kg',
    minThreshold: 5,
    costPerUnit: 100,
    supplier: '',
  });

  const categories = ['all', 'Proteins', 'Grains & Produce', 'Dairy & Alternatives', 'Dressings & Sauces', 'Packaging'];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    let matchesStock = true;
    if (stockStatusFilter === 'out') {
      matchesStock = item.quantity === 0;
    } else if (stockStatusFilter === 'low') {
      matchesStock = item.quantity > 0 && item.quantity <= item.minThreshold;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  const outOfStockItems = items.filter((i) => i.quantity === 0);
  const outOfStockCount = outOfStockItems.length;

  const lowStockItems = items.filter((i) => i.quantity > 0 && i.quantity <= i.minThreshold);
  const lowStockCount = lowStockItems.length;

  const totalValuation = items.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0);

  async function handleAdjustQuantity(id: string, delta: number) {
    if (!session.can('inventory.write')) {
      toast.error('Permission denied', { description: 'Your role cannot edit inventory.' });
      return;
    }
    if (busyId) return;

    const item = items.find((i) => i.id === id);
    if (!item) return;

    setBusyId(id);
    try {
      const { on_hand } = await api.post<{ on_hand: number }>(
        `/admin/inventory/${id}/movements`,
        {
          kind: delta > 0 ? 'receipt' : 'issue',
          quantity: Math.abs(delta),
          reason: delta > 0 ? 'Manual restock' : 'Kitchen issue',
        },
      );
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: on_hand } : i)));
      toast.success(`${item.name}: ${on_hand} ${item.unit}`);
    } catch (e) {
      toast.error('Could not update stock', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();

    if (!session.can('inventory.write')) {
      toast.error('Permission denied', { description: 'Your role cannot edit inventory.' });
      return;
    }
    if (!newItem.name.trim()) {
      toast.error('Item name is required');
      return;
    }

    try {
      await api.post('/admin/inventory', {
        sku: newItem.sku.trim() || `RAW-${Date.now().toString().slice(-6)}`,
        name: newItem.name.trim(),
        category: newItem.category,
        unit: newItem.unit,
        min_threshold: Number(newItem.minThreshold),
        cost_per_unit: Number(newItem.costPerUnit),
        supplier: newItem.supplier.trim() || 'Direct Vendor',
        opening_quantity: Number(newItem.quantity),
      });

      await load();
      setShowAddModal(false);
      toast.success(`Added ${newItem.name.trim()} to the inventory ledger`);
      setNewItem({
        name: '', sku: '', category: 'Proteins', quantity: 10,
        unit: 'kg', minThreshold: 5, costPerUnit: 100, supplier: '',
      });
    } catch (err) {
      toast.error('Could not add that item', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleUpdateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    if (!session.can('inventory.write')) {
      toast.error('Permission denied', { description: 'Your role cannot edit inventory.' });
      return;
    }

    try {
      if (isApiConfigured) {
        await api.patch(`/admin/inventory/${editingItem.id}`, {
          name: editingItem.name,
          category: editingItem.category,
          unit: editingItem.unit,
          min_threshold: editingItem.minThreshold,
          cost_per_unit: editingItem.costPerUnit,
          supplier: editingItem.supplier,
        });
      }

      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? editingItem : i)));
      toast.success(`Updated ${editingItem.name}`);
      setEditingItem(null);
    } catch (err) {
      toast.error('Could not update item', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDeleteItem() {
    if (!deletingItem) return;

    if (!session.can('inventory.write')) {
      toast.error('Permission denied', { description: 'Your role cannot delete inventory.' });
      return;
    }

    try {
      if (isApiConfigured) {
        await api.delete(`/admin/inventory/${deletingItem.id}`);
      }

      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      toast.success(`Deleted ${deletingItem.name} from stock ledger`);
      setDeletingItem(null);
    } catch (err) {
      toast.error('Could not delete item', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500 py-12">
        <Loader2 className="size-4 animate-spin text-emerald-700" />
        <span>Loading Kitchen Stock Ledger…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black text-neutral-900 tracking-tight">Inventory & Stock Ledger</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 border border-emerald-200/80 px-3 py-0.5 text-xs font-black text-emerald-900 shadow-2xs">
              <Boxes className="size-3 text-emerald-700" /> Kitchen Store #1
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            Real-time raw material quantities, reorder thresholds, and live valuation ledger
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 active:scale-[0.98] transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className="size-3.5 text-neutral-500" />
            <span>Refresh Ledger</span>
          </button>

          {session.can('inventory.write') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-800 active:scale-[0.98] shadow-2xs cursor-pointer"
            >
              <Plus className="size-4" /> Add Raw Material
            </button>
          )}
        </div>
      </div>

      {/* Critical Out of Stock & Low Stock Banner */}
      {(outOfStockCount > 0 || lowStockCount > 0) && (
        <div className={`rounded-2xl border p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          outOfStockCount > 0
            ? 'border-rose-300 bg-gradient-to-r from-rose-50 via-rose-50/70 to-white'
            : 'border-amber-300 bg-gradient-to-r from-amber-50 via-amber-50/80 to-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 border ${
              outOfStockCount > 0 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}>
              {outOfStockCount > 0 ? <AlertOctagon className="size-5 text-rose-700" /> : <AlertTriangle className="size-5 text-amber-700" />}
            </div>
            <div>
              <h4 className={`text-xs font-black uppercase tracking-wider ${
                outOfStockCount > 0 ? 'text-rose-950' : 'text-amber-950'
              }`}>
                {outOfStockCount > 0
                  ? `Critical Alert: ${outOfStockCount} Out-of-Stock Item${outOfStockCount > 1 ? 's' : ''}`
                  : `Action Required: ${lowStockCount} Item${lowStockCount > 1 ? 's' : ''} Below Minimum Threshold`}
              </h4>
              <p className={`text-xs font-medium mt-0.5 ${
                outOfStockCount > 0 ? 'text-rose-800' : 'text-amber-800'
              }`}>
                {outOfStockCount > 0
                  ? `Immediate kitchen restock needed for ${outOfStockItems.map((i) => i.name).slice(0, 3).join(', ')}${outOfStockCount > 3 ? ` and ${outOfStockCount - 3} more` : ''}.`
                  : `Reorder needed for ${lowStockItems.map((i) => i.name).slice(0, 3).join(', ')}${lowStockCount > 3 ? ` and ${lowStockCount - 3} more` : ''}.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {outOfStockCount > 0 && (
              <button
                onClick={() => setStockStatusFilter(stockStatusFilter === 'out' ? 'all' : 'out')}
                className="rounded-xl border border-rose-300 bg-rose-100/90 px-3.5 py-1.5 text-xs font-black text-rose-900 hover:bg-rose-200 active:scale-[0.98] transition cursor-pointer"
              >
                {stockStatusFilter === 'out' ? 'Show All Items' : 'Filter Out of Stock'}
              </button>
            )}
            {lowStockCount > 0 && (
              <button
                onClick={() => setStockStatusFilter(stockStatusFilter === 'low' ? 'all' : 'low')}
                className="rounded-xl border border-amber-300 bg-amber-100/90 px-3.5 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-200 active:scale-[0.98] transition cursor-pointer"
              >
                {stockStatusFilter === 'low' ? 'Show All Items' : 'Filter Low Stock'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Items */}
        <div
          onClick={() => setStockStatusFilter('all')}
          className={`rounded-2xl border p-4 shadow-2xs hover:shadow-xs transition cursor-pointer ${
            stockStatusFilter === 'all'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200/80 bg-gradient-to-br from-white to-neutral-50 hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${stockStatusFilter === 'all' ? 'text-neutral-300' : 'text-neutral-500'}`}>
              Total Tracked
            </span>
            <div className={`p-2 rounded-xl ${stockStatusFilter === 'all' ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-100 text-neutral-700'}`}>
              <Boxes className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-3xl font-black tracking-tight ${stockStatusFilter === 'all' ? 'text-white' : 'text-neutral-900'}`}>
              {items.length}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              stockStatusFilter === 'all'
                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                : 'bg-neutral-100 text-neutral-500 border-neutral-200/60'
            }`}>
              All Ingredients
            </span>
          </div>
        </div>

        {/* Card 2: Out of Stock Option */}
        <div
          onClick={() => setStockStatusFilter(stockStatusFilter === 'out' ? 'all' : 'out')}
          className={`rounded-2xl border p-4 shadow-2xs hover:shadow-xs transition cursor-pointer ${
            stockStatusFilter === 'out'
              ? 'border-rose-600 bg-rose-950 text-white'
              : outOfStockCount > 0
              ? 'border-rose-200 bg-gradient-to-br from-rose-50/80 via-rose-50/40 to-white hover:border-rose-300'
              : 'border-neutral-200/80 bg-gradient-to-br from-white to-neutral-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${
              stockStatusFilter === 'out' ? 'text-rose-200' : outOfStockCount > 0 ? 'text-rose-800' : 'text-neutral-500'
            }`}>
              Out of Stock
            </span>
            <div className={`p-2 rounded-xl ${
              stockStatusFilter === 'out'
                ? 'bg-rose-900 text-rose-100'
                : outOfStockCount > 0
                ? 'bg-rose-100 text-rose-800'
                : 'bg-neutral-100 text-neutral-500'
            }`}>
              <XCircle className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-3xl font-black tracking-tight ${
              stockStatusFilter === 'out' ? 'text-white' : outOfStockCount > 0 ? 'text-rose-950' : 'text-neutral-900'
            }`}>
              {outOfStockCount}
            </span>
            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${
              stockStatusFilter === 'out'
                ? 'bg-rose-900 text-rose-100 border-rose-800'
                : outOfStockCount > 0
                ? 'bg-rose-100 text-rose-900 border-rose-200'
                : 'bg-emerald-100 text-emerald-900 border-emerald-200'
            }`}>
              {outOfStockCount > 0 ? 'Depleted' : '0 Depleted'}
            </span>
          </div>
        </div>

        {/* Card 3: Low Stock Reorders */}
        <div
          onClick={() => setStockStatusFilter(stockStatusFilter === 'low' ? 'all' : 'low')}
          className={`rounded-2xl border p-4 shadow-2xs hover:shadow-xs transition cursor-pointer ${
            stockStatusFilter === 'low'
              ? 'border-amber-600 bg-amber-950 text-white'
              : lowStockCount > 0
              ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-amber-50/40 to-white hover:border-amber-300'
              : 'border-neutral-200/80 bg-gradient-to-br from-white to-neutral-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${
              stockStatusFilter === 'low' ? 'text-amber-200' : lowStockCount > 0 ? 'text-amber-800' : 'text-neutral-500'
            }`}>
              Low Stock Reorders
            </span>
            <div className={`p-2 rounded-xl ${
              stockStatusFilter === 'low'
                ? 'bg-amber-900 text-amber-100'
                : lowStockCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-3xl font-black tracking-tight ${
              stockStatusFilter === 'low' ? 'text-white' : lowStockCount > 0 ? 'text-amber-950' : 'text-neutral-900'
            }`}>
              {lowStockCount}
            </span>
            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${
              stockStatusFilter === 'low'
                ? 'bg-amber-900 text-amber-100 border-amber-800'
                : lowStockCount > 0
                ? 'bg-amber-100 text-amber-900 border-amber-200'
                : 'bg-emerald-100 text-emerald-900 border-emerald-200'
            }`}>
              {lowStockCount > 0 ? 'Needs Restock' : 'Stock Optimal'}
            </span>
          </div>
        </div>

        {/* Card 4: Total Stock Valuation */}
        <div className="rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-white to-neutral-50 p-4 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Total Stock Valuation</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Sparkles className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-neutral-900 tracking-tight">{formatINR(totalValuation)}</span>
            <span className="text-[11px] font-bold text-neutral-500">At Cost Price</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Category / Stock Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 size-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by raw ingredient name, SKU code, or vendor supplier..."
            className="w-full rounded-xl border border-neutral-200 pl-10 pr-4 py-2 text-xs font-semibold text-neutral-800 placeholder-neutral-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stock Status Selector Chips */}
          <div className="flex items-center gap-1 border border-neutral-200 rounded-xl p-1 bg-neutral-50 text-xs font-bold">
            <button
              onClick={() => setStockStatusFilter('all')}
              className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                stockStatusFilter === 'all'
                  ? 'bg-neutral-900 font-extrabold text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStockStatusFilter('out')}
              className={`rounded-lg px-3 py-1 transition cursor-pointer flex items-center gap-1.5 ${
                stockStatusFilter === 'out'
                  ? 'bg-rose-700 font-black text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50 font-bold'
              }`}
            >
              <XCircle className="size-3" /> Out of Stock ({outOfStockCount})
            </button>
            <button
              onClick={() => setStockStatusFilter('low')}
              className={`rounded-lg px-3 py-1 transition cursor-pointer flex items-center gap-1.5 ${
                stockStatusFilter === 'low'
                  ? 'bg-amber-600 font-black text-white shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-50 font-bold'
              }`}
            >
              <AlertTriangle className="size-3" /> Low Stock ({lowStockCount})
            </button>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 cursor-pointer shadow-2xs"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Inventory Ledger Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-2xs">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50/80 text-left text-xs font-extrabold text-neutral-600 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">SKU & Raw Ingredient</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Supplier</th>
              <th className="px-5 py-3.5 text-right">Cost / Unit</th>
              <th className="px-5 py-3.5 text-right">Current Stock</th>
              <th className="px-5 py-3.5 text-center">Stock Status</th>
              <th className="px-5 py-3.5 text-center">Actions & Stock Steppers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-xs font-medium text-neutral-400">
                  No inventory items found matching your filter criteria.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isOut = item.quantity === 0;
                const isLow = !isOut && item.quantity <= item.minThreshold;
                const categoryBadgeClass = CATEGORY_COLORS[item.category] || 'bg-neutral-100 text-neutral-800 border-neutral-200';

                return (
                  <tr key={item.id} className={`transition-colors ${
                    isOut
                      ? 'bg-rose-50/40 hover:bg-rose-50/70'
                      : isLow
                      ? 'bg-amber-50/40 hover:bg-amber-50/70'
                      : 'hover:bg-neutral-50/80'
                  }`}>
                    {/* Clickable SKU & Name */}
                    <td
                      onClick={() => setEditingItem(item)}
                      className="px-5 py-3.5 cursor-pointer group"
                    >
                      <div className="font-extrabold text-neutral-900 group-hover:text-emerald-700 transition flex items-center gap-1.5">
                        <span>{item.name}</span>
                        <Pencil className="size-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <div className="font-mono text-[11px] font-bold text-neutral-400">{item.sku}</div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black border shadow-2xs ${categoryBadgeClass}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-neutral-600">{item.supplier}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-black tabular-nums text-neutral-900">
                      {formatINR(item.costPerUnit)} <span className="text-[10px] text-neutral-400 font-normal">/ {item.unit}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      <div className={`font-black text-sm ${
                        isOut ? 'text-rose-700' : isLow ? 'text-amber-800' : 'text-neutral-900'
                      }`}>
                        {item.quantity} <span className="text-xs font-bold">{item.unit}</span>
                      </div>
                      <div className="text-[11px] font-medium text-neutral-400">Min: {item.minThreshold} {item.unit}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-black text-rose-900 border border-rose-200 shadow-2xs">
                          <XCircle className="size-3.5 text-rose-700" /> Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-black text-amber-900 border border-amber-200 shadow-2xs">
                          <AlertTriangle className="size-3 text-amber-700" /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-900 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 className="size-3 text-emerald-700" /> In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex items-center gap-2">
                        {/* Edit & Delete Action Buttons */}
                        {session.can('inventory.write') && (
                          <div className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-2xs">
                            <button
                              onClick={() => setEditingItem(item)}
                              title="Edit Item Details"
                              className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-emerald-700 transition cursor-pointer"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingItem(item)}
                              title="Delete Item"
                              className="rounded-lg p-1.5 text-neutral-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Stock Adjustment Steppers */}
                        {session.can('inventory.write') && (
                          <div className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-2xs">
                            <button
                              onClick={() => handleAdjustQuantity(item.id, -1)}
                              disabled={busyId === item.id || item.quantity <= 0}
                              title="Issue kitchen stock (-1)"
                              className="rounded-lg px-2 py-1 text-xs font-black text-neutral-700 hover:bg-neutral-100 hover:text-red-700 disabled:opacity-40 transition cursor-pointer"
                            >
                              -1
                            </button>
                            <span className="h-4 w-px bg-neutral-200"></span>
                            <button
                              onClick={() => handleAdjustQuantity(item.id, 1)}
                              disabled={busyId === item.id}
                              title="Add stock (+1)"
                              className="rounded-lg px-2 py-1 text-xs font-black text-emerald-800 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              +1
                            </button>
                            <span className="h-4 w-px bg-neutral-200"></span>
                            <button
                              onClick={() => handleAdjustQuantity(item.id, 5)}
                              disabled={busyId === item.id}
                              title="Restock delivery (+5)"
                              className="rounded-lg px-2.5 py-1 text-xs font-black text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition cursor-pointer"
                            >
                              +5
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900">Add Raw Ingredient / Material</h3>
                <p className="text-xs text-neutral-500 font-medium">Register a new raw material to track in kitchen stock ledger.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-extrabold text-neutral-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Hass Avocado Bulk"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    placeholder="RAW-AVO-01"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-mono font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as InventoryItem['category'] })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                  >
                    <option value="Proteins">Proteins</option>
                    <option value="Grains & Produce">Grains & Produce</option>
                    <option value="Dairy & Alternatives">Dairy & Alternatives</option>
                    <option value="Dressings & Sauces">Dressings & Sauces</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Initial Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Unit</label>
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value as InventoryItem['unit'] })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                  >
                    <option value="kg">kg</option>
                    <option value="litres">litres</option>
                    <option value="units">units</option>
                    <option value="packs">packs</option>
                  </select>
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.minThreshold}
                    onChange={(e) => setNewItem({ ...newItem, minThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Cost Per Unit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.costPerUnit}
                    onChange={(e) => setNewItem({ ...newItem, costPerUnit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Supplier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Organic Farms Co."
                    value={newItem.supplier}
                    onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-800 transition cursor-pointer shadow-xs"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
                  <Pencil className="size-4 text-emerald-700" /> Edit Raw Ingredient
                </h3>
                <p className="text-xs text-neutral-500 font-medium">Update parameters for {editingItem.sku}</p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-extrabold text-neutral-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">SKU Code (Read only)</label>
                  <input
                    type="text"
                    disabled
                    value={editingItem.sku}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3.5 py-2 text-xs font-mono font-semibold text-neutral-500"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                  >
                    <option value="Proteins">Proteins</option>
                    <option value="Grains & Produce">Grains & Produce</option>
                    <option value="Dairy & Alternatives">Dairy & Alternatives</option>
                    <option value="Dressings & Sauces">Dressings & Sauces</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">On Hand Quantity</label>
                  <input
                    type="number"
                    disabled
                    value={editingItem.quantity}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-600"
                  />
                  <span className="text-[10px] text-neutral-400 font-medium">Use steppers for stock move</span>
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Unit</label>
                  <select
                    value={editingItem.unit}
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                  >
                    <option value="kg">kg</option>
                    <option value="litres">litres</option>
                    <option value="units">units</option>
                    <option value="packs">packs</option>
                  </select>
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.minThreshold}
                    onChange={(e) => setEditingItem({ ...editingItem, minThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Cost Per Unit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.costPerUnit}
                    onChange={(e) => setEditingItem({ ...editingItem, costPerUnit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-neutral-700 mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={editingItem.supplier}
                    onChange={(e) => setEditingItem({ ...editingItem, supplier: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingItem(editingItem);
                    setEditingItem(null);
                  }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="size-3.5" /> Delete Ingredient
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-extrabold text-white hover:bg-emerald-800 transition cursor-pointer shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                <Trash2 className="size-6 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900">Delete Raw Material?</h3>
                <p className="text-xs text-neutral-500 font-medium">This will remove <strong className="text-neutral-900 font-bold">{deletingItem.name}</strong> ({deletingItem.sku}) from the stock ledger.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs text-rose-900 font-medium">
              Are you sure? Deleted ingredients cannot be referenced for future stock movements.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingItem(null)}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteItem()}
                className="rounded-xl bg-rose-700 px-5 py-2 text-xs font-black text-white hover:bg-rose-800 transition cursor-pointer shadow-xs"
              >
                Delete Ingredient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
