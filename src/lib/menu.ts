import { api, isApiConfigured } from './api';
import { SAMPLE_PRODUCTS, type Product } from './shopify';
import type { NutritionInfo } from './nutritionParser';

/** Shape returned by GET /menu. */
interface MenuRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: string | number;
  image_url: string | null;
  prep_time: string | null;
  tags: string[] | string | null;
  is_popular: number | boolean;
  is_available?: number | boolean;
  category_slug: string | null;
  category_name: string | null;
  calories: string | number | null;
  protein_g: string | number | null;
  carbs_g: string | number | null;
  fat_g: string | number | null;
  fiber_g: string | number | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

function toNutrition(row: MenuRow): NutritionInfo {
  return {
    calories: num(row.calories),
    protein: num(row.protein_g),
    carbs: num(row.carbs_g),
    fat: num(row.fat_g),
    fiber: num(row.fiber_g),
  };
}

const DEFAULT_IMAGE_MAP: Record<string, string> = {
  'quinoa-paneer-bowl': '/images/quinoa_paneer_bowl.png',
  'grilled-chicken-brown-rice': '/images/grilled_chicken_brown_rice.png',
  'paneer-tikka-millet-bowl': '/images/paneer_tikka_millet.png',
  'sprouts-peanut-bowl': '/images/sprouts_peanut_bowl.png',
  'mediterranean-chicken-hummus': '/images/hummus_bowl.png',
  'mediterranean-chicken-hummus-bowl': '/images/hummus_bowl.png',
  'protein-oats-honey-pancakes': '/images/protein_pancakes.png',
  'hummus-veg-wrap': '/images/hummus_veg_wrap.png',
  'grilled-chicken-wrap': '/images/grilled_chicken_wrap.png',
  'egg-white-avocado-wrap': '/images/egg_white_avocado_wrap.png',
  'paneer-tikka-wrap': '/images/paneer_tikka_wrap.png',
  'green-detox': '/images/green_detox_smoothie.png',
  'green-detox-smoothie': '/images/green_detox_smoothie.png',
  'berry-protein-smoothie': '/images/berry_protein_smoothie.png',
  'peanut-butter-banana-smoothie': '/images/peanut_butter_banana.png',
  'cold-pressed-abc-juice': '/images/cold_pressed_abc_juice.png',
  'mediterranean-chicken-salad': '/images/mediterranean_chicken.png',
  'grilled-chicken-caesar-lite': '/images/grilled_chicken_caesar.png',
  'sprout-feta-salad': '/images/sprouts_peanut_bowl.png',
  'fresh-mix-cut-fruit-bowl': '/images/mix_fruit_bowl.png',
  'berry-chia-oats': '/images/berry_chia_oats.png',
  'paneer-tikka-salad': '/images/paneer_tikka_salad.png',
  'chocolate-whey-shake': '/images/chocolate_whey_shake.png',
  'roasted-trail-mix': '/images/roasted_trail_mix.png',
};

function getImageUrl(row: MenuRow): string {
  if (row.image_url && row.image_url.trim()) {
    return row.image_url.trim();
  }
  const slug = (row.slug || '').toLowerCase().trim();
  if (DEFAULT_IMAGE_MAP[slug]) {
    return DEFAULT_IMAGE_MAP[slug];
  }
  const name = (row.name || '').toLowerCase();
  if (name.includes('fruit') || name.includes('mix cut')) return '/images/mix_fruit_bowl.png';
  if (name.includes('detox') || name.includes('green')) return '/images/green_detox_smoothie.png';
  if (name.includes('berry') && name.includes('smoothie')) return '/images/berry_protein_smoothie.png';
  if (name.includes('peanut butter') || name.includes('banana')) return '/images/peanut_butter_banana.png';
  if (name.includes('abc') || name.includes('juice')) return '/images/cold_pressed_abc_juice.png';
  if (name.includes('pancake')) return '/images/protein_pancakes.png';
  if (name.includes('hummus') && name.includes('wrap')) return '/images/hummus_veg_wrap.png';
  if (name.includes('chicken') && name.includes('wrap')) return '/images/grilled_chicken_wrap.png';
  if (name.includes('egg') && name.includes('wrap')) return '/images/egg_white_avocado_wrap.png';
  if (name.includes('paneer') && name.includes('wrap')) return '/images/paneer_tikka_wrap.png';
  if (name.includes('caesar')) return '/images/grilled_chicken_caesar.png';
  if (name.includes('hummus') || name.includes('mediterranean')) return '/images/hummus_bowl.png';
  if (name.includes('paneer') && name.includes('salad')) return '/images/paneer_tikka_salad.png';
  if (name.includes('paneer') && name.includes('bowl')) return '/images/quinoa_paneer_bowl.png';
  if (name.includes('chicken') && name.includes('rice')) return '/images/grilled_chicken_brown_rice.png';
  if (name.includes('millet')) return '/images/paneer_tikka_millet.png';
  if (name.includes('sprout')) return '/images/sprouts_peanut_bowl.png';
  if (name.includes('shake') || name.includes('chocolate')) return '/images/chocolate_whey_shake.png';
  if (name.includes('oats')) return '/images/berry_chia_oats.png';

  return '/images/hero_bowl.png';
}

function toProduct(row: MenuRow): Product {
  const amount = String(num(row.price));
  const imageUrl = getImageUrl(row);
  const image = { url: imageUrl, altText: row.name };
  const isAvailable = row.is_available === undefined || row.is_available === null ? true : Boolean(Number(row.is_available));

  // MySQL has no array type, so tags come back as a JSON string.
  let tags: string[] = [];
  if (Array.isArray(row.tags)) tags = row.tags;
  else if (typeof row.tags === 'string') {
    try { const t = JSON.parse(row.tags); if (Array.isArray(t)) tags = t; } catch { tags = []; }
  }

  return {
    id: row.id,
    handle: row.slug,
    title: row.name,
    description: row.description ?? '',
    productType: row.category_name ?? 'Meals',
    tags,
    featuredImage: image,
    images: [image],
    priceRange: { minVariantPrice: { amount, currencyCode: 'INR' } },
    variants: [{ id: row.id, title: 'Regular', price: { amount, currencyCode: 'INR' }, availableForSale: isAvailable }],
    nutrition: toNutrition(row),
    prepTime: row.prep_time ?? '20-25 mins',
    isPopular: Boolean(Number(row.is_popular)),
    isAvailable,
  };
}

export async function fetchMenu(): Promise<Product[]> {
  if (!isApiConfigured) return SAMPLE_PRODUCTS;
  try {
    const { items } = await api.get<{ items: MenuRow[] }>('/menu');
    return items.length ? items.map(toProduct) : SAMPLE_PRODUCTS;
  } catch {
    return SAMPLE_PRODUCTS;
  }
}

export async function fetchMenuItemBySlug(slug: string): Promise<Product | null> {
  const all = await fetchMenu();
  return all.find((p) => p.handle === slug) ?? null;
}

export async function fetchCategories(): Promise<Array<{ slug: string; name: string }>> {
  if (!isApiConfigured) return [];
  try {
    const { categories } = await api.get<{ categories: Array<{ slug: string; name: string }> }>('/categories');
    return categories;
  } catch {
    return [];
  }
}

let cachedOutletId: string | null = null;

export async function fetchDefaultOutletId(): Promise<string | null> {
  if (!isApiConfigured) return null;
  if (cachedOutletId) return cachedOutletId;
  try {
    const { outlets } = await api.get<{ outlets: Array<{ id: string }> }>('/outlets');
    return (cachedOutletId = outlets[0]?.id ?? null);
  } catch {
    return null;
  }
}

export async function ensureAddress(params: { line1: string; city?: string; pincode?: string }): Promise<string | null> {
  if (!isApiConfigured || !params.line1.trim()) return null;
  try {
    const { address } = await api.post<{ address: { id: string } }>('/addresses', params);
    return address.id;
  } catch {
    return null;
  }
}

/**
 * Places an order.
 *
 * Note what is NOT sent: no price, no total. The API reads prices from
 * menu_items and computes the total itself, so a tampered client cannot buy a
 * ₹180 bowl for ₹1. Verified by tests T14-T17 in api/tests/security_test.py.
 */
export async function placeOrder(params: {
  outletId: string;
  lines: Array<{
    menuItemId: string | null;
    quantity: number;
    notes?: string;
    name?: string;
    price?: number;
    calories?: number;
    protein?: number;
  }>;
  addressId?: string;
  scheduledFor?: string;
  notes?: string;
}): Promise<{ orderId: string; orderNo: string; total: number } | { error: string }> {
  try {
    const { order } = await api.post<{
      order: { id: string; order_no: string; total: number };
    }>('/orders', {
      outlet_id: params.outletId,
      address_id: params.addressId ?? null,
      scheduled_for: params.scheduledFor ?? null,
      notes: params.notes ?? null,
      lines: params.lines.map((l) => ({
        menu_item_id: l.menuItemId,
        quantity: l.quantity,
        notes: l.notes ?? null,
        name: l.name ?? null,
        price: l.price ?? null,
        calories: l.calories ?? null,
        protein: l.protein ?? null,
      })),
    });
    return { orderId: order.id, orderNo: order.order_no, total: Number(order.total) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not place your order' };
  }
}

export interface ApiOrder {
  id: string;
  order_no: string;
  status: string;
  total: string | number;
  total_protein: string | number;
  total_calories: string | number;
  created_at: string;
  notes: string | null;
  lines?: Array<{ name_snapshot: string; quantity: number; unit_price: string; line_total: string; notes?: string | null }>;
}

export async function fetchMyOrders(): Promise<ApiOrder[]> {
  if (!isApiConfigured) return [];
  try {
    const { orders } = await api.get<{ orders: ApiOrder[] }>('/orders');
    return orders;
  } catch {
    return [];
  }
}

export async function cancelOrderApi(orderId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  if (!isApiConfigured) return { ok: false, error: 'API not configured' };
  try {
    await api.post(`/orders/${encodeURIComponent(orderId)}/cancel`, { reason });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not cancel order' };
  }
}

