import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  dietary: string[];
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string;
  status: 'ACTIVE' | 'VIP' | 'NEW';
  createdAt: string;
}

interface CustomerState {
  customers: CustomerRecord[];

  // Actions
  upsertCustomer: (details: {
    name: string;
    email?: string;
    phone: string;
    address?: string;
    dietary?: string[];
    spentAmount?: number;
  }) => CustomerRecord;
  deleteCustomer: (id: string) => void;
  resetCustomers: () => void;
}

const INITIAL_CUSTOMERS_LIST: CustomerRecord[] = [
  {
    id: 'CUST-101',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    phone: '+91 98765 43210',
    address: '42 Park Avenue, Koramangala 5th Block, Bengaluru, 560095',
    dietary: ['High Protein', 'Gluten Free'],
    ordersCount: 14,
    totalSpent: 4186,
    lastOrderDate: 'Today, 2:15 PM',
    status: 'VIP',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'CUST-102',
    name: 'Priya Sharma',
    email: 'priya.s@healthlife.org',
    phone: '+91 98123 76543',
    address: '88 Indiranagar 100ft Road, Bengaluru, 560038',
    dietary: ['Low Carb', 'Vegan'],
    ordersCount: 8,
    totalSpent: 2192,
    lastOrderDate: 'Yesterday, 8:30 PM',
    status: 'ACTIVE',
    createdAt: '2026-02-14T14:30:00Z',
  },
  {
    id: 'CUST-103',
    name: 'Rohan Verma',
    email: 'rohan.v@techstudio.io',
    phone: '+91 97654 32109',
    address: '15 HSR Layout Sector 1, Bengaluru, 560102',
    dietary: ['High Protein', 'Keto Friendly'],
    ordersCount: 22,
    totalSpent: 7458,
    lastOrderDate: 'Today, 11:45 AM',
    status: 'VIP',
    createdAt: '2026-01-05T09:15:00Z',
  },
  {
    id: 'CUST-104',
    name: 'Deepak Kumar',
    email: 'deepak.kumar@example.com',
    phone: '+91 98765 12345',
    address: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru, 560103',
    dietary: ['High Protein'],
    ordersCount: 6,
    totalSpent: 1840,
    lastOrderDate: 'Today, 1:00 PM',
    status: 'ACTIVE',
    createdAt: '2026-02-20T16:00:00Z',
  },
];

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: INITIAL_CUSTOMERS_LIST,

      upsertCustomer: (details) => {
        const { name, email, phone, address, dietary, spentAmount } = details;
        const currentList = get().customers;

        // Find existing customer by email or phone
        const existingIndex = currentList.findIndex(
          (c) =>
            (email && c.email && c.email.toLowerCase() === email.toLowerCase()) ||
            (phone && c.phone && c.phone.trim() === phone.trim()) ||
            (name && c.name && c.name.toLowerCase() === name.toLowerCase())
        );

        if (existingIndex >= 0) {
          const existing = currentList[existingIndex];
          const newOrdersCount = spentAmount ? existing.ordersCount + 1 : existing.ordersCount;
          const newTotalSpent = spentAmount ? existing.totalSpent + spentAmount : existing.totalSpent;
          const newStatus = newOrdersCount >= 10 || newTotalSpent >= 3500 ? 'VIP' : 'ACTIVE';

          const updated: CustomerRecord = {
            ...existing,
            name: name || existing.name,
            email: email || existing.email,
            phone: phone || existing.phone,
            address: address || existing.address,
            dietary: dietary && dietary.length > 0 ? dietary : existing.dietary,
            ordersCount: newOrdersCount,
            totalSpent: newTotalSpent,
            lastOrderDate: spentAmount ? 'Just now' : existing.lastOrderDate,
            status: newStatus,
          };

          const updatedList = [...currentList];
          updatedList[existingIndex] = updated;

          set({ customers: updatedList });
          return updated;
        } else {
          // Create new customer record
          const newId = `CUST-${Math.floor(100 + Math.random() * 900)}`;
          const newCustomer: CustomerRecord = {
            id: newId,
            name: name || 'Valued Customer',
            email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            phone: phone || '+91 98765 00000',
            address: address || 'Delivery Address Provided at Checkout',
            dietary: dietary || ['High Protein'],
            ordersCount: spentAmount ? 1 : 0,
            totalSpent: spentAmount || 0,
            lastOrderDate: spentAmount ? 'Just now' : 'Registered recently',
            status: spentAmount ? 'ACTIVE' : 'NEW',
            createdAt: new Date().toISOString(),
          };

          set({ customers: [newCustomer, ...currentList] });
          return newCustomer;
        }
      },

      deleteCustomer: (id) => {
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        }));
      },

      resetCustomers: () => {
        set({ customers: INITIAL_CUSTOMERS_LIST });
      },
    }),
    {
      name: 'brokole-customers-storage',
    }
  )
);
