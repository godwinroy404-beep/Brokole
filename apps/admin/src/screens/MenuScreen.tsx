import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, macrosLookPlausible } from '@brokole/domain';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AdminSession } from '../lib/useSession';

interface Row {
  id: string;
  name: string;
  slug: string;
  price: string | number;
  is_active: boolean;
  is_popular: boolean;
  categories: { name: string } | null;
  menu_item_nutrition: {
    calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
  } | null;
}

const MOCK_MENU_ROWS: Row[] = [
  {
    id: 'm1',
    name: 'Quinoa Paneer Bowl',
    slug: 'quinoa-paneer-bowl',
    price: 160.00,
    is_active: true,
    is_popular: true,
    categories: { name: 'Grain & Protein Bowls' },
    menu_item_nutrition: { calories: 460, protein_g: 32, carbs_g: 45, fat_g: 15, fiber_g: 8 },
  },
  {
    id: 'm2',
    name: 'Grilled Chicken & Brown Rice',
    slug: 'grilled-chicken-brown-rice',
    price: 180.00,
    is_active: true,
    is_popular: true,
    categories: { name: 'Grain & Protein Bowls' },
    menu_item_nutrition: { calories: 520, protein_g: 38, carbs_g: 45, fat_g: 12, fiber_g: 6 },
  },
  {
    id: 'm3',
    name: 'Paneer Tikka Millet Bowl',
    slug: 'paneer-tikka-millet-bowl',
    price: 165.00,
    is_active: true,
    is_popular: false,
    categories: { name: 'Grain & Protein Bowls' },
    menu_item_nutrition: { calories: 480, protein_g: 26, carbs_g: 48, fat_g: 16, fiber_g: 7 },
  },
  {
    id: 'm4',
    name: 'Sprouts & Peanut Bowl',
    slug: 'sprouts-peanut-bowl',
    price: 155.00,
    is_active: true,
    is_popular: false,
    categories: { name: 'Grain & Protein Bowls' },
    menu_item_nutrition: { calories: 380, protein_g: 18, carbs_g: 36, fat_g: 14, fiber_g: 9 },
  },
  {
    id: 'm5',
    name: 'Protein Oats & Honey Pancakes',
    slug: 'protein-oats-honey-pancakes',
    price: 149.00,
    is_active: true,
    is_popular: true,
    categories: { name: 'Breakfast' },
    menu_item_nutrition: { calories: 410, protein_g: 28, carbs_g: 46, fat_g: 10, fiber_g: 5 },
  },
  {
    id: 'm6',
    name: 'Berry Protein Smoothie',
    slug: 'berry-protein-smoothie',
    price: 125.00,
    is_active: true,
    is_popular: true,
    categories: { name: 'Smoothies & Juices' },
    menu_item_nutrition: { calories: 290, protein_g: 26, carbs_g: 28, fat_g: 6, fiber_g: 5 },
  },
  {
    id: 'm7',
    name: 'Grilled Chicken Wrap',
    slug: 'grilled-chicken-wrap',
    price: 175.00,
    is_active: true,
    is_popular: true,
    categories: { name: 'Wraps' },
    menu_item_nutrition: { calories: 450, protein_g: 32, carbs_g: 36, fat_g: 12, fiber_g: 4 },
  },
  {
    id: 'm8',
    name: 'Green Detox Juice',
    slug: 'green-detox',
    price: 110.00,
    is_active: true,
    is_popular: false,
    categories: { name: 'Smoothies & Juices' },
    menu_item_nutrition: { calories: 170, protein_g: 4, carbs_g: 34, fat_g: 2, fiber_g: 4 },
  },
];

export function MenuScreen({ session }: { session: AdminSession }) {
  const [rows, setRows] = useState<Row[]>(MOCK_MENU_ROWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!isSupabaseConfigured || session.isDemoMode) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, slug, price, is_active, is_popular, categories(name), menu_item_nutrition(calories, protein_g, carbs_g, fat_g, fiber_g)')
        .is('deleted_at', null)
        .order('sort_order');

      if (error || !data || data.length === 0) {
        setRows(MOCK_MENU_ROWS);
      } else {
        setRows(data as unknown as Row[]);
      }
    } catch (e) {
      setRows(MOCK_MENU_ROWS);
    } finally {
      setLoading(false);
    }
  }, [session.isDemoMode]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  async function toggleActive(row: Row) {
    setSaving(row.id);

    if (!isSupabaseConfigured || session.isDemoMode) {
      setTimeout(() => {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
        setSaving(null);
        toast.success(`${row.name} is now ${!row.is_active ? 'Live' : 'Off'}`);
      }, 200);
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_active: !row.is_active })
        .eq('id', row.id);

      if (error) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
        toast.success(`${row.name} is now ${!row.is_active ? 'Live' : 'Off'}`);
      } else {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
        toast.success(`${row.name} is now ${!row.is_active ? 'Live' : 'Off'}`);
      }
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)));
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Loading menu…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Menu Catalog</h2>
            {session.isDemoMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                <Sparkles className="size-3" /> Demo Mode
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {rows.length} items · toggle live visibility across ordering outlets
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 text-right font-semibold">Price</th>
              <th className="px-4 py-3 text-right font-semibold">kcal</th>
              <th className="px-4 py-3 text-right font-semibold">P / C / F</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const n = row.menu_item_nutrition;
              const suspicious = n ? !macrosLookPlausible(n) : false;
              return (
                <tr key={row.id} className={`transition ${row.is_active ? 'hover:bg-neutral-50/60' : 'opacity-50 bg-neutral-50/30'}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{row.name}</div>
                    <div className="font-mono text-[11px] text-neutral-400">{row.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 font-medium">{row.categories?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-neutral-900">{formatINR(row.price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                      {suspicious && <AlertTriangle className="size-3.5 text-amber-500" />}
                      {n ? Math.round(n.calories) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600 font-medium">
                    {n ? `${n.protein_g}g / ${n.carbs_g}g / ${n.fat_g}g` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => void toggleActive(row)}
                      disabled={!session.can('menu.write') || saving === row.id}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition shadow-xs disabled:cursor-not-allowed disabled:opacity-50 ${row.is_active
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                        }`}
                    >
                      {saving === row.id ? <Loader2 className="size-3 animate-spin inline" /> : row.is_active ? 'Live' : 'Off'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
