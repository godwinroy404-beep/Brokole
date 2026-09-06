import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchMyOrders, cancelOrderApi } from '../lib/menu';
import { isApiConfigured } from '../lib/api';
import { useAuthStore } from './useAuthStore';
import { pushLocalOrderSync, fetchLocalSyncOrders } from '../lib/localSync';

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
   * The database UUID. Use THIS for any API call - passing `id` to an endpoint
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

        void pushLocalOrderSync(newOrder);

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

        const target = get().orders.find((o) => o.id === orderId || o.serverId === orderId);
        if (target) {
          void pushLocalOrderSync({ ...target, status });
        }

        if (isApiConfigured) {
          let dbStatus = 'accepted';
          if (status === 'New Order') dbStatus = 'placed';
          else if (status === 'Preparing') dbStatus = 'accepted';
          else if (status === 'Out for Delivery') dbStatus = 'out_for_delivery';
          else if (status === 'Delivered') dbStatus = 'delivered';
          else if (status === 'Cancelled') dbStatus = 'cancelled';

          const key = target?.serverId || target?.id || orderId;

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

        // Cancel locally in Zustand immediately
        get().updateOrderStatus(order.id, 'Cancelled');

        // If backend API is configured, notify it in background without failing UI
        if (isApiConfigured) {
          const key = order.serverId || order.id;
          void cancelOrderApi(key, reason).catch(() => {});
        }

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
        let serverOrders: Order[] = [];
        if (isApiConfigured) {
          try {
            const rows = await fetchMyOrders();
            const user = useAuthStore.getState().user;

            serverOrders = (rows || []).map((row) => ({
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
          } catch {
            serverOrders = [];
          }
        }

        let diskOrders: Order[] = [];
        try {
          const rawDisk = await fetchLocalSyncOrders();
          if (Array.isArray(rawDisk)) {
            diskOrders = rawDisk.map((diskOrd: any) => ({
              id: diskOrd.id || diskOrd.order_no || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
              serverId: diskOrd.serverId || diskOrd.id,
              customerName: diskOrd.customerName || diskOrd.customer_name || 'Customer',
              customerPhone: diskOrd.customerPhone || diskOrd.customer_phone || '+91 98765 00000',
              customerAddress: diskOrd.customerAddress || diskOrd.customer_address || 'Delivery Address',
              itemsSummary: diskOrd.itemsSummary || 'Fresh Healthy Bowl',
              itemsList: diskOrd.itemsList || [],
              totalAmount: diskOrd.totalAmount || diskOrd.total || 399,
              proteinGrams: diskOrd.proteinGrams || diskOrd.total_protein || 45,
              calories: diskOrd.calories || diskOrd.total_calories || 520,
              status: diskOrd.status || 'New Order',
              createdAt: diskOrd.createdAt || diskOrd.created_at || new Date().toISOString(),
              timeFormatted: 'Just now',
            }));
          }
        } catch {
          /* ignore */
        }

        set((state) => {
          const map = new Map<string, Order>();

          // 1. Current local state orders
          for (const o of state.orders) {
            const key = o.id || o.serverId;
            if (key) map.set(key, o);
          }

          // 2. Disk sync orders
          for (const o of diskOrders) {
            const key = o.id || o.serverId;
            if (key) {
              const existing = map.get(key);
              map.set(key, existing ? { ...existing, ...o, status: o.status || existing.status } : o);
            }
          }

          // 3. Server orders (highest priority for official server state)
          for (const o of serverOrders) {
            const key = o.id || o.serverId;
            if (key) map.set(key, o);
          }

          const combined = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          const updatedLatest = state.latestPlacedOrder
            ? combined.find((o) => o.id === state.latestPlacedOrder?.id || o.serverId === state.latestPlacedOrder?.serverId) || state.latestPlacedOrder
            : combined[0] || null;

          return {
            orders: combined,
            latestPlacedOrder: updatedLatest,
          };
        });
      },

      subscribeToMyOrders: () => {
        const tick = () => {
          if (document.visibilityState === 'visible') void get().loadMyOrders();
        };
        const interval = window.setInterval(tick, 3000);
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

