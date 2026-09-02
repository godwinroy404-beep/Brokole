import { useState } from 'react';
import {
  Boxes, AlertTriangle, Plus, Search, Filter,
  CheckCircle2, ArrowDownRight, ArrowUpRight, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@brokole/domain';
import type { AdminSession } from '../lib/useSession';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Proteins' | 'Grains & Produce' | 'Dairy & Alternatives' | 'Dressings & Sauces' | 'Packaging';
  quantity: number;
  unit: 'kg' | 'litres' | 'units' | 'packs';
  minThreshold: number;
  costPerUnit: number;
  lastRestocked: string;
  supplier: string;
}

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    sku: 'RAW-PNR-01',
    name: 'Organic Fresh Paneer',
    category: 'Dairy & Alternatives',
    quantity: 18.5,
    unit: 'kg',
    minThreshold: 10,
    costPerUnit: 280,
    lastRestocked: '2026-09-02',
    supplier: 'Heritage Dairy',
  },
  {
    id: 'inv-2',
    sku: 'RAW-CHK-01',
    name: 'Boneless Chicken Breast',
    category: 'Proteins',
    quantity: 8.2,
    unit: 'kg',
    minThreshold: 15,
    costPerUnit: 240,
    lastRestocked: '2026-09-01',
    supplier: 'FreshToHome Commercial',
  },
  {
    id: 'inv-3',
    sku: 'RAW-QNA-01',
    name: 'Organic White Quinoa',
    category: 'Grains & Produce',
    quantity: 35.0,
    unit: 'kg',
    minThreshold: 12,
    costPerUnit: 310,
    lastRestocked: '2026-08-28',
    supplier: 'OrgNation Farms',
  },
  {
    id: 'inv-4',
    sku: 'RAW-BRC-01',
    name: 'Organic Brown Rice',
    category: 'Grains & Produce',
    quantity: 45.0,
    unit: 'kg',
    minThreshold: 20,
    costPerUnit: 85,
    lastRestocked: '2026-08-25',
    supplier: 'GreenFields Agri',
  },
  {
    id: 'inv-5',
    sku: 'RAW-OAT-01',
    name: 'Rolled Oats (Bulk)',
    category: 'Grains & Produce',
    quantity: 22.0,
    unit: 'kg',
    minThreshold: 10,
    costPerUnit: 140,
    lastRestocked: '2026-08-30',
    supplier: 'Quaker Wholesale',
  },
  {
    id: 'inv-6',
    sku: 'RAW-BRO-01',
    name: 'Fresh Broccoli Florets',
    category: 'Grains & Produce',
    quantity: 4.5,
    unit: 'kg',
    minThreshold: 8,
    costPerUnit: 160,
    lastRestocked: '2026-09-02',
    supplier: 'Local Mandi Agri',
  },
  {
    id: 'inv-7',
    sku: 'RAW-YGT-01',
    name: 'Greek Yogurt (Hung Curd)',
    category: 'Dairy & Alternatives',
    quantity: 14.0,
    unit: 'kg',
    minThreshold: 8,
    costPerUnit: 190,
    lastRestocked: '2026-09-01',
    supplier: 'MilkyMist Supply',
  },
  {
    id: 'inv-8',
    sku: 'PKG-BWL-750',
    name: 'Eco Meal Bowls (750ml)',
    category: 'Packaging',
    quantity: 420,
    unit: 'units',
    minThreshold: 200,
    costPerUnit: 8.50,
    lastRestocked: '2026-08-24',
    supplier: 'BioPack Solutions',
  },
  {
    id: 'inv-9',
    sku: 'SAU-SSM-01',
    name: 'Sesame Herb Dressing',
    category: 'Dressings & Sauces',
    quantity: 6.5,
    unit: 'litres',
    minThreshold: 5,
    costPerUnit: 350,
    lastRestocked: '2026-09-01',
    supplier: 'In-House Kitchen Prep',
  },
  {
    id: 'inv-10',
    sku: 'RAW-WHY-01',
    name: 'Whey Protein Powder (Unflavored)',
    category: 'Proteins',
    quantity: 2.1,
    unit: 'kg',
    minThreshold: 5,
    costPerUnit: 2200,
    lastRestocked: '2026-08-20',
    supplier: 'Optimum Nutrition Bulk',
  },
];

export function InventoryScreen({ session }: { session: AdminSession }) {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku.toLowerCase().includes(searchQuery.toLowerCase()) || item.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesLowStock = !filterLowStockOnly || item.quantity <= item.minThreshold;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const lowStockCount = items.filter((i) => i.quantity <= i.minThreshold).length;
  const totalValuation = items.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0);

  function handleAdjustQuantity(id: string, delta: number) {
    if (!session.can('inventory.write')) {
      toast.error('Permission denied', { description: 'Your role cannot edit inventory.' });
      return;
    }

    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const newQty = Math.max(0, Math.round((i.quantity + delta) * 10) / 10);
          toast.success(`Updated ${i.name}: ${newQty} ${i.unit}`);
          return { ...i, quantity: newQty };
        }
        return i;
      })
    );
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.name.trim()) {
      toast.error('Item name is required');
      return;
    }

    const created: InventoryItem = {
      id: `inv-${Date.now()}`,
      sku: newItem.sku.trim() || `RAW-${Date.now().toString().slice(-4)}`,
      name: newItem.name.trim(),
      category: newItem.category,
      quantity: Number(newItem.quantity),
      unit: newItem.unit,
      minThreshold: Number(newItem.minThreshold),
      costPerUnit: Number(newItem.costPerUnit),
      lastRestocked: new Date().toISOString().split('T')[0],
      supplier: newItem.supplier.trim() || 'Direct Vendor',
    };

    setItems((prev) => [created, ...prev]);
    setShowAddModal(false);
    toast.success(`Added ${created.name} to inventory ledger`);
    setNewItem({
      name: '',
      sku: '',
      category: 'Proteins',
      quantity: 10,
      unit: 'kg',
      minThreshold: 5,
      costPerUnit: 100,
      supplier: '',
    });
  }

  return (
    <div className="space-y-5">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-900">Inventory & Stock Ledger</h2>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
              Kitchen Store #1
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Real-time raw material quantities, reorder thresholds, and valuation
          </p>
        </div>

        {session.can('inventory.write') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 shadow-sm"
          >
            <Plus className="size-4" /> Add Raw Material
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Total Tracked Items</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900">{items.length}</span>
            <Boxes className="size-5 text-neutral-400" />
          </div>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm transition ${lowStockCount > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-neutral-200 bg-white'}`}>
          <div className="text-xs font-medium text-neutral-600">Low Stock Alerts</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
            </span>
            <AlertTriangle className={`size-5 ${lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">Stock Valuation</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900">{formatINR(totalValuation)}</span>
            <span className="text-xs font-medium text-neutral-400">At cost price</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ingredient, SKU, or supplier..."
            className="w-full rounded-lg border border-neutral-200 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 outline-none focus:border-brand-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>

          <button
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${filterLowStockOnly
                ? 'border-amber-300 bg-amber-100 text-amber-900 font-semibold'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
          >
            <Filter className="size-3.5" /> Low Stock Only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-semibold">SKU & Item Name</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 text-right font-semibold">Cost / Unit</th>
              <th className="px-4 py-3 text-right font-semibold">Current Stock</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              {session.can('inventory.write') && <th className="px-4 py-3 text-center font-semibold">Stock Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredItems.map((item) => {
              const isLow = item.quantity <= item.minThreshold;
              return (
                <tr key={item.id} className={`transition ${isLow ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-neutral-50/60'}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{item.name}</div>
                    <div className="font-mono text-[11px] text-neutral-400">{item.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-neutral-600">{item.category}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{item.supplier}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium tabular-nums text-neutral-900">
                    {formatINR(item.costPerUnit)} / {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className={`font-bold text-sm ${isLow ? 'text-amber-700' : 'text-neutral-900'}`}>
                      {item.quantity} {item.unit}
                    </div>
                    <div className="text-[11px] text-neutral-400">Min: {item.minThreshold} {item.unit}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                        <AlertTriangle className="size-3 text-amber-600" /> Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="size-3 text-emerald-600" /> In Stock
                      </span>
                    )}
                  </td>
                  {session.can('inventory.write') && (
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-2xs">
                        <button
                          onClick={() => handleAdjustQuantity(item.id, -1)}
                          title="Reduce stock (-1)"
                          className="rounded p-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          -1
                        </button>
                        <span className="h-4 w-px bg-neutral-200"></span>
                        <button
                          onClick={() => handleAdjustQuantity(item.id, +5)}
                          title="Add restock (+5)"
                          className="rounded p-1 font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-xs text-neutral-500">
            No inventory items match your current filter query.
          </div>
        )}
      </div>

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-neutral-900 mb-1">Add Raw Ingredient / Material</h3>
            <p className="text-xs text-neutral-500 mb-4">Register a new raw material to track in kitchen stock ledger.</p>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Avocado Hass Bulk"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    placeholder="RAW-AVO-01"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as InventoryItem['category'] })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="Proteins">Proteins</option>
                    <option value="Grains & Produce">Grains & Produce</option>
                    <option value="Dairy & Alternatives">Dairy & Alternatives</option>
                    <option value="Dressings & Sauces">Dressings & Sauces</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Initial Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Unit</label>
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value as InventoryItem['unit'] })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="kg">kg</option>
                    <option value="litres">litres</option>
                    <option value="units">units</option>
                    <option value="packs">packs</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.minThreshold}
                    onChange={(e) => setNewItem({ ...newItem, minThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Cost Per Unit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.costPerUnit}
                    onChange={(e) => setNewItem({ ...newItem, costPerUnit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Supplier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. OrgNation"
                    value={newItem.supplier}
                    onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
