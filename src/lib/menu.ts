import { supabase, isSupabaseConfigured } from './supabase';
import { SAMPLE_PRODUCTS, type Product } from './shopify';
import type { NutritionInfo } from './nutritionParser';
import { useOrderStore } from '../store/useOrderStore';
import { useCustomerStore } from '../store/useCustomerStore';

interface MenuRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: string | number;
  image_url: string | null;
  prep_time: string | null;
  tags: string[] | null;
  is_popular: boolean;
  category_slug: string | null;
  category_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}

function toNutrition(row: MenuRow): NutritionInfo {
  return {
    calories: Number(row.calories ?? 0),
    protein: Number(row.protein_g ?? 0),
    carbs: Number(row.carbs_g ?? 0),
    fat: Number(row.fat_g ?? 0),
    fiber: Number(row.fiber_g ?? 0),
  };
}

function toProduct(row: MenuRow): Product {
  const amount = String(row.price ?? 0);
  const image = {
    url: row.image_url ?? '/images/quinoa_paneer_bowl.png',
    altText: row.name,
  };

  return {
    id: row.id,
    handle: row.slug,
    title: row.name,
    description: row.description ?? '',
    productType: row.category_name ?? 'Meals',
    tags: row.tags ?? [],
    featuredImage: image,
    images: [image],
    priceRange: { minVariantPrice: { amount, currencyCode: 'INR' } },
    variants: [
      {
        id: row.id,
        title: 'Regular',
        price: { amount, currencyCode: 'INR' },
        availableForSale: true,
      },
    ],
    nutrition: toNutrition(row),
    prepTime: row.prep_time ?? '20-25 mins',
    isPopular: row.is_popular,
  };
}

/** The whole live menu. Falls back to SAMPLE_PRODUCTS if database is offline. */
export async function fetchMenu(): Promise<Product[]> {
  if (!isSupabaseConfigured) {
    return SAMPLE_PRODUCTS;
  }

  try {
    const { data, error } = await supabase
      .from('menu_view')
      .select('*')
      .order('sort_order');

    if (error || !data || data.length === 0) {
      return SAMPLE_PRODUCTS;
    }
    return (data as MenuRow[]).map(toProduct);
  } catch (e) {
    return SAMPLE_PRODUCTS;
  }
}

export async function fetchMenuItemBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured) {
    return SAMPLE_PRODUCTS.find((p) => p.handle === slug) || null;
  }

  try {
    const { data, error } = await supabase
      .from('menu_view')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      return SAMPLE_PRODUCTS.find((p) => p.handle === slug) || null;
    }
    return toProduct(data as MenuRow);
  } catch (e) {
    return SAMPLE_PRODUCTS.find((p) => p.handle === slug) || null;
  }
}

/** Categories for the filter strip. */
export async function fetchCategories(): Promise<Array<{ slug: string; name: string }>> {
  if (!isSupabaseConfigured) {
    return [
      { slug: 'grain-protein-bowls', name: 'Grain & Protein Bowls' },
      { slug: 'breakfast', name: 'Breakfast' },
      { slug: 'wraps', name: 'Wraps' },
      { slug: 'smoothies-juices', name: 'Smoothies & Juices' },
      { slug: 'salads-bowls', name: 'Salads & Bowls' },
      { slug: 'snacks-sides', name: 'Snacks & Sides' },
    ];
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name')
      .order('sort_order');

    if (error || !data || data.length === 0) {
      return [
        { slug: 'grain-protein-bowls', name: 'Grain & Protein Bowls' },
        { slug: 'breakfast', name: 'Breakfast' },
        { slug: 'wraps', name: 'Wraps' },
        { slug: 'smoothies-juices', name: 'Smoothies & Juices' },
        { slug: 'salads-bowls', name: 'Salads & Bowls' },
        { slug: 'snacks-sides', name: 'Snacks & Sides' },
      ];
    }
    return data;
  } catch (e) {
    return [];
  }
}

/** Places an order and broadcasts it to the Admin operations console in real time. */
export async function placeOrder(params: {
  outletId: string;
  lines: Array<{ menuItemId: string; quantity: number; notes?: string }>;
  addressId?: string;
  scheduledFor?: string;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
}): Promise<{ orderId: string } | { error: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('place_order', {
        p_outlet_id: params.outletId,
        p_lines: params.lines.map((l) => ({
          menu_item_id: l.menuItemId,
          quantity: l.quantity,
          notes: l.notes ?? null,
        })),
        p_address_id: params.addressId ?? null,
        p_scheduled_for: params.scheduledFor ?? null,
        p_notes: params.notes ?? null,
      });

      // Surface real failures instead of falling through to a fake local order.
      // Silently "succeeding" here is how a customer gets a confirmation for an
      // order that never reached the kitchen.
      if (error) return { error: error.message };
      if (!data) return { error: 'The order was not created. Please try again.' };
      return { orderId: data as string };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Could not reach the kitchen. Check your connection.',
      };
    }
  }

  // Local Sync Order Placement
  const itemsText = params.lines.map((l) => `Item #${l.menuItemId} x${l.quantity}`).join(', ');
  const createdOrder = useOrderStore.getState().addOrder({
    customerName: params.customerName || 'Brokole Customer',
    customerPhone: params.customerPhone || '+91 98765 43210',
    customerAddress: params.customerAddress || 'Bengaluru Delivery Address',
    itemsSummary: itemsText,
    totalAmount: 350,
    proteinGrams: 45,
    calories: 520,
  });

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('brokole_realtime_sync_channel');
      channel.postMessage({ type: 'NEW_ORDER_PLACED', order: createdOrder });
      channel.close();
    } catch (e) {
      // ignore
    }
  }

  return { orderId: createdOrder.id };
}

export async function fetchMyOrders() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_no, status, total, total_protein, total_calories, created_at, order_lines(name_snapshot, quantity, line_total)')
        .order('created_at', { ascending: false });

      if (!error && data) return data;
    } catch (e) {
      // ignore
    }
  }

  return useOrderStore.getState().orders;
}


// ── helpers the checkout flow needs ─────────────────────────────────────────

let cachedOutletId: string | null = null;

/**
 * The outlet an order belongs to. Cached for the session — you have one kitchen
 * today, but every order still carries an outlet_id so a second one costs
 * nothing later.
 */
export async function fetchDefaultOutletId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  if (cachedOutletId) return cachedOutletId;

  const { data, error } = await supabase
    .from('outlets')
    .select('id')
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  cachedOutletId = data.id as string;
  return cachedOutletId;
}

/**
 * Turns the free-text address typed at checkout into a real `addresses` row and
 * returns its id. Reuses an identical existing address rather than piling up
 * duplicates every time the customer orders.
 */
export async function ensureAddress(params: {
  line1: string;
  city?: string;
  pincode?: string;
  label?: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const line1 = params.line1.trim();
  if (!line1) return null;

  const { data: existing } = await supabase
    .from('addresses')
    .select('id')
    .eq('profile_id', auth.user.id)
    .eq('line1', line1)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) return existing.id as string;

  // Pull a 6-digit pincode out of the typed address when the field is blank.
  const pincode = params.pincode?.trim() || line1.match(/\b(\d{6})\b/)?.[1] || '000000';

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      profile_id: auth.user.id,
      label: params.label ?? 'Delivery',
      line1,
      city: params.city?.trim() || 'Bengaluru',
      pincode,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return data.id as string;
}
