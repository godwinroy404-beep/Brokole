import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
    case 'accepted':
      return 'New Order';
    case 'in_kitchen':
    case 'packed':
      return 'Preparing';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
    case 'refunded':
      return 'Cancelled';
    default:
      return 'Pre-Order Scheduled';
  }
}

export interface OrderItem {
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
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

  /** Loads this customer's real orders. RLS guarantees they can only be theirs. */
  loadMyOrders: () => Promise<void>;
  /** Live status updates pushed from the kitchen. Returns an unsubscribe fn. */
  subscribeToMyOrders: () => () => void;
}

const INITIAL_SEED_ORDERS: Order[] = [
  {
    id: 'ORD-9844',
    userId: 'user_104',
    userEmail: 'deepak.kumar@example.com',
    customerName: 'Deepak Kumar',
    customerPhone: '+91 98765 12345',
    customerAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru, 560103',
    itemsSummary: 'Teriyaki Salmon Macro Bowl x1, Green Detox Smoothie x1',
    totalAmount: 498,
    proteinGrams: 52,
    calories: 580,
    status: 'New Order',
    createdAt: new Date().toISOString(),
    timeFormatted: 'Just now',
    isNew: true,
  },
  {
    id: 'ORD-9843',
    userId: 'user_101',
    userEmail: 'alex.morgan@example.com',
    customerName: 'Alex Morgan',
    customerPhone: '+91 98765 43210',
    customerAddress: '42 Park Avenue, Koramangala 5th Block, Bengaluru, 560095',
    itemsSummary: 'Grilled Chicken & Quinoa Bowl x2',
    totalAmount: 698,
    proteinGrams: 84,
    calories: 920,
    status: 'Pre-Order Scheduled',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    timeFormatted: '12 mins ago',
  },
  {
    id: 'ORD-9842',
    userId: 'user_103',
    userEmail: 'rohan.v@techstudio.io',
    customerName: 'Rohan Verma',
    customerPhone: '+91 97654 32109',
    customerAddress: '15 HSR Layout Sector 1, Bengaluru, 560102',
    itemsSummary: 'Chocolate Whey Shake x1, Paneer Tikka Salad x1',
    totalAmount: 528,
    proteinGrams: 60,
    calories: 650,
    status: 'Preparing',
    createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    timeFormatted: '24 mins ago',
  },
  {
    id: 'ORD-9841',
    userId: 'user_102',
    userEmail: 'priya.s@healthlife.org',
    customerName: 'Priya Sharma',
    customerPhone: '+91 98123 76543',
    customerAddress: '88 Indiranagar 100ft Road, Bengaluru, 560038',
    itemsSummary: 'Green Detox Smoothie x2, Berry Chia Oats x1',
    totalAmount: 557,
    proteinGrams: 27,
    calories: 480,
    status: 'Delivered',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    timeFormatted: '1 hour ago',
  },
];

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
            o.id === orderId ? { ...o, status, isNew: false } : o
          );
          const updatedLatest =
            state.latestPlacedOrder?.id === orderId
              ? { ...state.latestPlacedOrder, status, isNew: false }
              : state.latestPlacedOrder;

          return {
            orders: updatedOrders,
            latestPlacedOrder: updatedLatest,
          };
        });
      },

      deleteOrder: (orderId) => {
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== orderId),
          latestPlacedOrder:
            state.latestPlacedOrder?.id === orderId ? null : state.latestPlacedOrder,
        }));
      },

      clearLatestPlacedOrder: () => {
        set({ latestPlacedOrder: null });
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
        if (!isSupabaseConfigured) return;

        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        const { data, error } = await supabase
          .from('orders')
          .select(
            'id, order_no, status, total, total_protein, total_calories, created_at, notes, order_lines(name_snapshot, quantity, unit_price, line_total)',
          )
          .order('created_at', { ascending: false })
          .limit(50);

        if (error || !data) return;

        const mapped: Order[] = data.map((row: any) => ({
          id: row.order_no,
          customerName: 'You',
          customerPhone: '',
          customerAddress: '',
          itemsSummary: (row.order_lines ?? [])
            .map((l: any) => `${l.name_snapshot} x${l.quantity}`)
            .join(', '),
          itemsList: (row.order_lines ?? []).map((l: any) => ({
            title: l.name_snapshot,
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

        set({ orders: mapped });
      },

      subscribeToMyOrders: () => {
        if (!isSupabaseConfigured) return () => {};

        const channel = supabase
          .channel('my-orders')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            () => {
              void get().loadMyOrders();
            },
          )
          .subscribe();

        return () => {
          void supabase.removeChannel(channel);
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
