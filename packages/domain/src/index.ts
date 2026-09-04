/**
 * @brokole/domain — the single source of truth shared by the customer app and
 * the admin console. If a rule lives here, the two apps cannot disagree about it.
 *
 * Nothing in this file talks to the network. It mirrors the database contract
 * defined in supabase/migrations, and it is intentionally dependency-free.
 */

// ── roles & permissions ─────────────────────────────────────────────────────

export const APP_ROLES = [
  'customer',
  'kitchen_staff',
  'delivery_rider',
  'dietitian',
  'inventory_manager',
  'accountant',
  'store_manager',
  'owner',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type Permission =
  | 'menu.read'
  | 'menu.write'
  | 'orders.read.all'
  | 'orders.update.status'
  | 'inventory.read'
  | 'inventory.write'
  | 'vendors.read'
  | 'vendors.write'
  | 'customers.read'
  | 'finance.read'
  | 'staff.manage'
  | 'audit.read';

/** Roles allowed through the admin console door. Mirrors is_staff() in SQL. */
export const STAFF_ROLES: readonly AppRole[] = APP_ROLES.filter((r) => r !== 'customer');

export function isStaffRole(role: string | null | undefined): role is AppRole {
  return !!role && role !== 'customer' && (APP_ROLES as readonly string[]).includes(role);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  customer: 'Customer',
  kitchen_staff: 'Kitchen',
  delivery_rider: 'Rider',
  dietitian: 'Dietitian',
  inventory_manager: 'Inventory Manager',
  accountant: 'Accountant',
  store_manager: 'Store Manager',
  owner: 'Owner',
};

// ── order state machine (mirrors update_order_status in SQL) ────────────────

export const ORDER_STATUSES = [
  'draft', 'placed', 'paid', 'accepted', 'in_kitchen',
  'packed', 'out_for_delivery', 'delivered', 'cancelled', 'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The client copy exists so buttons can be greyed out. The database copy is the
 * one that decides. Keep them identical; the SQL wins on any disagreement.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft:            ['placed', 'cancelled'],
  placed:           ['paid', 'accepted', 'cancelled'],
  paid:             ['accepted', 'cancelled', 'refunded'],
  accepted:         ['in_kitchen', 'cancelled'],
  in_kitchen:       ['packed', 'cancelled'],
  packed:           ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered:        ['refunded'],
  cancelled:        [],
  refunded:         [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** The next step a kitchen user would normally take. */
export function nextStatus(from: OrderStatus): OrderStatus | null {
  const happyPath: Partial<Record<OrderStatus, OrderStatus>> = {
    placed: 'accepted',
    paid: 'accepted',
    accepted: 'in_kitchen',
    in_kitchen: 'packed',
    packed: 'out_for_delivery',
    out_for_delivery: 'delivered',
  };
  return happyPath[from] ?? null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  placed: 'Placed',
  paid: 'Paid',
  accepted: 'Accepted',
  in_kitchen: 'In Kitchen',
  packed: 'Packed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

// ── money ───────────────────────────────────────────────────────────────────

/**
 * Prices are numeric(12,2) in Postgres and arrive as strings or numbers.
 * Never do arithmetic on a formatted string.
 */
export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatINR(value: string | number | null | undefined): string {
  const amt = toAmount(value);
  const isInteger = Number.isInteger(amt) || Math.abs(amt - Math.round(amt)) < 0.001;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amt);
}

// ── pricing rules (mirrors place_order in SQL) ──────────────────────────────
// Displayed to the customer before checkout. The database recomputes all of it.

export const GST_RATE = 0.05;             // food supply, no ITC
export const FREE_DELIVERY_OVER = 499;
export const DELIVERY_FEE = 29;

export interface QuoteLine { price: string | number; quantity: number }

export function quote(lines: QuoteLine[]) {
  const subtotal = lines.reduce((sum, l) => sum + toAmount(l.price) * l.quantity, 0);
  const deliveryFee = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  const tax = Math.round(subtotal * GST_RATE * 100) / 100;
  return { subtotal, tax, deliveryFee, total: subtotal + tax + deliveryFee };
}

// ── macros ──────────────────────────────────────────────────────────────────

export interface Macros { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number }

export function sumMacros(items: Array<{ macros: Macros; quantity: number }>): Macros {
  return items.reduce<Macros>(
    (acc, { macros, quantity }) => ({
      calories:  acc.calories  + macros.calories  * quantity,
      protein_g: acc.protein_g + macros.protein_g * quantity,
      carbs_g:   acc.carbs_g   + macros.carbs_g   * quantity,
      fat_g:     acc.fat_g     + macros.fat_g     * quantity,
      fiber_g:  (acc.fiber_g ?? 0) + (macros.fiber_g ?? 0) * quantity,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  );
}

/** Sanity check for hand-entered nutrition: 4/4/9 kcal per gram, ±20% slack. */
export function macrosLookPlausible(m: Macros): boolean {
  if (m.calories <= 0) return false;
  const derived = m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
  const drift = Math.abs(derived - m.calories) / m.calories;
  return drift <= 0.2;
}

// ── row shapes ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: string | number;
  image_url: string | null;
  tags: string[];
  is_popular: boolean;
  is_active: boolean;
  category_id: string | null;
}

export interface Order {
  id: string;
  order_no: string;
  status: OrderStatus;
  channel?: string;
  business_date: string;
  subtotal: string | number;
  tax_amount: string | number;
  delivery_fee: string | number;
  total: string | number;
  total_calories: string | number;
  total_protein: string | number;
  customer_id: string;
  placed_at: string | null;
  created_at: string;
  notes: string | null;
  lines?: Array<{ name_snapshot: string; quantity: number; unit_price: string; line_total: string; notes?: string | null }>;
}
