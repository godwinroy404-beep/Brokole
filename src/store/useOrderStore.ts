import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchMyOrders, cancelOrderApi } from '../lib/menu';
import { isApiConfigured } from '../lib/api';
import { useAuthStore } from './useAuthStore';

export type OrderStatus =
  | 'New Order'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Pre-Order Scheduled'
  | 'Cancelled';

/** Maps the database's order_status enum onto the labels this UI already uses. */
export function mapDbStatus(dbStatus: string): OrderStatus {
  switch (dbStatus) {
    case 'placed':
    case 'paid':
      return 'New Order';
    case 'accepted':
    case 'in_kitchen':
    case 'packed':
    case 'preparing':
      return 'Preparing';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
    case 'canceled':
    case 'refunded':
      return 'Cancelled';
    default:
      return 'New Order';
  }
}

export interface OrderItem {
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
}

export interface Order {
  /**
   * The human-readable order number ("BKL-260904-1042"). This is what the UI
   * displays, so it is deliberately NOT the database key.
   */
  id: string;
  /**
   * The database UUID. Use THIS for any API call — passing `id` to an endpoint
   * that expects a primary key silently fails the ownership check and comes
   * back as 403 "That order is not yours".
   */
  serverId?: string;
  userId?: string;
  userEmail?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  itemsSummary: string;
  itemsList?: OrderItem[];
  totalAmount: number;
  proteinGrams: number;
  calories?: number;
  status: OrderStatus;
  createdAt: string;
  timeFormatted: string;
  isNew?: boolean;
}

interface OrderState {
  orders: Order[];
  latestPlacedOrder: Order | null;
  
  // Actions
  addOrder: (orderData: Partial<Order> & { customerName: string; totalAmount: number; itemsSummary: string }) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  deleteOrder: (orderId: string) => void;
  clearLatestPlacedOrder: () => void;
  simulateNewOrder: () => Order;
  resetOrders: () => void;

  cancelUserOrder: (orderId: string, reason?: string) => Promise<{ ok: boolean; error?: string }>;

  /** Loads this customer's real orders. RLS guarantees they can only be theirs. */
  loadMyOrders: () => Promise<void>;
  /** Live status updates pushed from the kitchen. Returns an unsubscribe fn. */
  subscribeToMyOrders: () => () => void;
}

const INITIAL_SEED_ORDERS: Order[] = [];

const RANDOM_NAMES = [
  'Vikram Mehta', 'Neha Kapoor', 'Siddharth Rao', 'Kavya Nair', 
  'Arjun Sengupta', 'Tanya Deshmukh', 'Rahul Oberoi', 'Simran Gill'
];

const RANDOM_ADDRESSES = [
  'Flat 204, Prestigio Towers, Indiranagar, Bengaluru',
  'Villa 12, Palm Meadows, Whitefield, Bengaluru',
  'Tower B-801, Mantri Elegance, Bannerghatta Rd, Bengaluru',
  'House #45, 14th Main, HSR Layout Sector 3, Bengaluru',
  'Apartment 301, Salarpuria Sattva, Koramangala, Bengaluru'
];

const RANDOM_MEAL_COMBOS = [
  { items: 'Quinoa Paneer Bowl x1, Protein Oats x1', total: 420, protein: 58, calories: 640 },
  { items: 'Grilled Chicken & Brown Rice x2', total: 360, protein: 76, calories: 1040 },
  { items: 'Mediterranean Hummus Bowl x1, Avocado Toast x1', total: 450, protein: 32, calories: 510 },
  { items: 'High Protein Whey Smoothie x2, Trail Mix x1', total: 380, protein: 64, calories: 590 },
  { items: 'Paneer Tikka Salad x1, Green Detox Juice x1', total: 390, protein: 44, calories: 480 },
];

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: INITIAL_SEED_ORDERS,
      latestPlacedOrder: null,

      addOrder: (orderData) => {
        const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
        const newOrder: Order = {
          id: orderId,
          userId: orderData.userId,
          userEmail: orderData.userEmail,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone || '+91 98765 00000',
          customerAddress: orderData.customerAddress || 'Customer Address Provided',
          itemsSummary: orderData.itemsSummary,
          itemsList: orderData.itemsList || [],
          totalAmount: orderData.totalAmount,
          proteinGrams: orderData.proteinGrams || 45,
          calories: orderData.calories || 520,
          status: 'New Order',
          createdAt: new Date().toISOString(),
          timeFormatted: 'Just now',
          isNew: true,
        };

        set((state) => ({
          orders: [newOrder, ...state.orders],
          latestPlacedOrder: newOrder,
        }));

        return newOrder;
      },

      updateOrderStatus: (orderId, status) => {
        set((state) => {
          const updatedOrders = state.orders.map((o) =>
            o.id === orderId || o.serverId === orderId ? { ...o, status, isNew: false } : o
          );
          const updatedLatest =
            state.latestPlacedOrder?.id === orderId || state.latestPlacedOrder?.serverId === orderId
              ? { ...state.latestPlacedOrder, status, isNew: false }
              : state.latestPlacedOrder;

          return {
            orders: updatedOrders,
            latestPlacedOrder: updatedLatest,
          };
        });

        if (isApiConfigured) {
          let dbStatus = 'accepted';
          if (status === 'New Order') dbStatus = 'placed';
          else if (status === 'Preparing') dbStatus = 'accepted';
          else if (status === 'Out for Delivery') dbStatus = 'out_for_delivery';
          else if (status === 'Delivered') dbStatus = 'delivered';
          else if (status === 'Cancelled') dbStatus = 'cancelled';

          const target = get().orders.find((o) => o.id === orderId || o.serverId === orderId);
          const key = target?.serverId || target?.id || orderId;

          void cancelOrderApi(key, status).catch(() => {});
          // Also try direct PATCH via api
          import('../lib/api').then(({ api }) => {
            void api.patch(`/orders/${encodeURIComponent(key)}/status`, { status: dbStatus }).catch(() => {});
          }).catch(() => {});
        }
      },

      deleteOrder: (orderId) => {
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== orderId && o.serverId !== orderId),
          latestPlacedOrder:
            state.latestPlacedOrder?.id === orderId || state.latestPlacedOrder?.serverId === orderId
              ? null
              : state.latestPlacedOrder,
        }));
      },

      clearLatestPlacedOrder: () => {
        set({ latestPlacedOrder: null });
      },

      cancelUserOrder: async (orderId, reason) => {
        const state = get();
        let order = state.orders.find((o) => o.id === orderId || o.serverId === orderId);

        if (!order && state.latestPlacedOrder && (state.latestPlacedOrder.id === orderId || state.latestPlacedOrder.serverId === orderId)) {
          order = state.latestPlacedOrder;
        }

        if (!order) {
          const lower = (orderId || '').toLowerCase();
          order = state.orders.find(
            (o) => (o.id || '').toLowerCase() === lower || (o.serverId || '').toLowerCase() === lower
          );
        }

        if (!order) {
          return { ok: false, error: 'Order not found' };
        }

        const currentStatus = (order.status || '').toLowerCase();
        if (
          currentStatus.includes('packed') ||
          currentStatus.includes('out for delivery') ||
          currentStatus.includes('delivered') ||
          currentStatus.includes('cancelled') ||
          currentStatus.includes('canceled')
        ) {
          return { ok: false, error: 'Order cannot be cancelled once it is packed or out for delivery' };
        }

        if (isApiConfigured) {
          const key = order.serverId || order.id;
          const res = await cancelOrderApi(key, reason);
          if (!res.ok) {
            if (res.error === 'Order not found' || (res.error && res.error.toLowerCase().includes('not found'))) {
              get().updateOrderStatus(order.id, 'Cancelled');
              return { ok: true };
            }
            return res;
          }
        }

        get().updateOrderStatus(order.id, 'Cancelled');
        return { ok: true };
      },

      simulateNewOrder: () => {
        const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
        const randomAddress = RANDOM_ADDRESSES[Math.floor(Math.random() * RANDOM_ADDRESSES.length)];
        const combo = RANDOM_MEAL_COMBOS[Math.floor(Math.random() * RANDOM_MEAL_COMBOS.length)];
        const randomPhone = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;
        const randomEmail = `${randomName.toLowerCase().replace(' ', '.')}@example.com`;

        return get().addOrder({
          userEmail: randomEmail,
          customerName: randomName,
          customerPhone: randomPhone,
          customerAddress: randomAddress,
          itemsSummary: combo.items,
          totalAmount: combo.total,
          proteinGrams: combo.protein,
          calories: combo.calories,
        });
      },

      loadMyOrders: async () => {
        if (!isApiConfigured) return;

        const rows = await fetchMyOrders();
        const user = useAuthStore.getState().user;

        const mappedOrders: Order[] = rows.map((row) => ({
          id: row.order_no,
          serverId: row.id,
          userId: user?.id,
          userEmail: user?.email,
          customerName: user?.name || 'You',
          customerPhone: user?.phone || '',
          customerAddress: user?.address || 'Delivery Address',
          itemsSummary: (row.lines ?? [])
            .map((l) => `${l.name_snapshot} x${l.quantity}${l.notes ? ` (${l.notes})` : ''}`)
            .join(' | '),
          itemsList: (row.lines ?? []).map((l) => ({
            title: l.notes ? `${l.name_snapshot} (${l.notes})` : l.name_snapshot,
            quantity: l.quantity,
            price: Number(l.unit_price),
          })),
          totalAmount: Number(row.total),
          proteinGrams: Number(row.total_protein ?? 0),
          calories: Number(row.total_calories ?? 0),
          status: mapDbStatus(row.status),
          createdAt: row.created_at,
          timeFormatted: new Date(row.created_at).toLocaleString('en-IN'),
        }));

        set((state) => {
          const currentLatestId = state.latestPlacedOrder?.id;
          const updatedLatest = currentLatestId
            ? mappedOrders.find((o) => o.id === currentLatestId) ?? state.latestPlacedOrder
            : mappedOrders.length > 0
            ? mappedOrders[0]
            : null;

          return {
            orders: mappedOrders,
            latestPlacedOrder: updatedLatest,
          };
        });
      },

      /**
       * MySQL has no equivalent of Supabase Realtime and shared hosting cannot
       * hold a WebSocket, so the live board is polling. Every 6 seconds is
       * responsive enough for a kitchen and cheap enough for shared hosting.
       */
      subscribeToMyOrders: () => {
        if (!isApiConfigured) return () => {};

        const tick = () => {
          if (document.visibilityState === 'visible') void get().loadMyOrders();
        };
        const interval = window.setInterval(tick, 6000);
        document.addEventListener('visibilitychange', tick);

        return () => {
          window.clearInterval(interval);
          document.removeEventListener('visibilitychange', tick);
        };
      },

      resetOrders: () => {
        set({
          orders: INITIAL_SEED_ORDERS,
          latestPlacedOrder: null,
        });
      },
    }),
    {
      name: 'brokole-orders-storage',
    }
  )
);
