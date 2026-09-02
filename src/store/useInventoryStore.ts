import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Protein' | 'Grains & Carbs' | 'Produce' | 'Healthy Fats' | 'Dairy & Whey' | 'Packaging';
  stockQuantity: number;
  unit: 'kg' | 'grams' | 'liters' | 'units' | 'packs';
  minThreshold: number;
  costPerUnit: number;
  supplier: string;
  lastRestocked: string;
  status: 'In Stock' | 'Low Stock' | 'Critical';
}

interface InventoryState {
  items: InventoryItem[];

  // Actions
  restockItem: (id: string, amount: number) => void;
  updateStock: (id: string, newQuantity: number) => void;
  addItem: (item: Omit<InventoryItem, 'id' | 'lastRestocked' | 'status'>) => void;
  deleteItem: (id: string) => void;
  restockAllLowItems: () => void;
  resetInventory: () => void;
}

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'ING-101',
    name: 'Organic Chicken Breast (Boneless)',
    category: 'Protein',
    stockQuantity: 45,
    unit: 'kg',
    minThreshold: 15,
    costPerUnit: 280,
    supplier: 'Poultry Fresh Farms',
    lastRestocked: 'Today, 7:00 AM',
    status: 'In Stock',
  },
  {
    id: 'ING-102',
    name: 'Fresh Farm Paneer (Cottage Cheese)',
    category: 'Protein',
    stockQuantity: 8,
    unit: 'kg',
    minThreshold: 12,
    costPerUnit: 340,
    supplier: 'DairyCraft India',
    lastRestocked: 'Yesterday',
    status: 'Low Stock',
  },
  {
    id: 'ING-103',
    name: 'Norwegian Wild Salmon Fillets',
    category: 'Protein',
    stockQuantity: 4,
    unit: 'kg',
    minThreshold: 8,
    costPerUnit: 1200,
    supplier: 'Oceanic Seafood Imports',
    lastRestocked: '2 days ago',
    status: 'Critical',
  },
  {
    id: 'ING-104',
    name: 'Organic White Quinoa',
    category: 'Grains & Carbs',
    stockQuantity: 32,
    unit: 'kg',
    minThreshold: 10,
    costPerUnit: 180,
    supplier: 'Andean Grains Co.',
    lastRestocked: '3 days ago',
    status: 'In Stock',
  },
  {
    id: 'ING-105',
    name: 'Brown Basmati Rice',
    category: 'Grains & Carbs',
    stockQuantity: 50,
    unit: 'kg',
    minThreshold: 20,
    costPerUnit: 95,
    supplier: 'Heritage Agro Mills',
    lastRestocked: '5 days ago',
    status: 'In Stock',
  },
  {
    id: 'ING-106',
    name: 'Fresh Broccoli Florets',
    category: 'Produce',
    stockQuantity: 6,
    unit: 'kg',
    minThreshold: 10,
    costPerUnit: 120,
    supplier: 'Green Valley Organic Produce',
    lastRestocked: 'Today, 6:00 AM',
    status: 'Low Stock',
  },
  {
    id: 'ING-107',
    name: 'Hass Avocados (Imported)',
    category: 'Healthy Fats',
    stockQuantity: 24,
    unit: 'units',
    minThreshold: 30,
    costPerUnit: 85,
    supplier: 'Tropic Orchards',
    lastRestocked: 'Yesterday',
    status: 'Low Stock',
  },
  {
    id: 'ING-108',
    name: 'Whey Protein Isolate (Unflavored)',
    category: 'Dairy & Whey',
    stockQuantity: 18,
    unit: 'kg',
    minThreshold: 5,
    costPerUnit: 1850,
    supplier: 'NutraPure Science Ltd',
    lastRestocked: '1 week ago',
    status: 'In Stock',
  },
  {
    id: 'ING-109',
    name: 'Greek Yogurt (Plain 0% Fat)',
    category: 'Dairy & Whey',
    stockQuantity: 28,
    unit: 'liters',
    minThreshold: 10,
    costPerUnit: 160,
    supplier: 'MilkyWay Organics',
    lastRestocked: 'Yesterday',
    status: 'In Stock',
  },
  {
    id: 'ING-110',
    name: 'Biodegradable Meal Bowls (750ml)',
    category: 'Packaging',
    stockQuantity: 420,
    unit: 'units',
    minThreshold: 100,
    costPerUnit: 12,
    supplier: 'EcoPack Solutions',
    lastRestocked: '4 days ago',
    status: 'In Stock',
  },
];

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      items: INITIAL_INVENTORY,

      restockItem: (id, amount) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === id) {
              const newQty = item.stockQuantity + amount;
              const newStatus =
                newQty <= item.minThreshold / 2
                  ? 'Critical'
                  : newQty <= item.minThreshold
                  ? 'Low Stock'
                  : 'In Stock';
              return {
                ...item,
                stockQuantity: newQty,
                lastRestocked: 'Just now',
                status: newStatus,
              };
            }
            return item;
          }),
        }));
      },

      updateStock: (id, newQuantity) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === id) {
              const qty = Math.max(0, newQuantity);
              const newStatus =
                qty <= item.minThreshold / 2
                  ? 'Critical'
                  : qty <= item.minThreshold
                  ? 'Low Stock'
                  : 'In Stock';
              return {
                ...item,
                stockQuantity: qty,
                status: newStatus,
              };
            }
            return item;
          }),
        }));
      },

      addItem: (newItemData) => {
        const newId = `ING-${Math.floor(100 + Math.random() * 900)}`;
        const qty = newItemData.stockQuantity;
        const status =
          qty <= newItemData.minThreshold / 2
            ? 'Critical'
            : qty <= newItemData.minThreshold
            ? 'Low Stock'
            : 'In Stock';

        const newItem: InventoryItem = {
          ...newItemData,
          id: newId,
          lastRestocked: 'Just now',
          status,
        };

        set((state) => ({
          items: [newItem, ...state.items],
        }));
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      restockAllLowItems: () => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.status === 'Low Stock' || item.status === 'Critical') {
              const restockAmount = item.minThreshold * 2;
              return {
                ...item,
                stockQuantity: item.stockQuantity + restockAmount,
                lastRestocked: 'Just now (Batch Restock)',
                status: 'In Stock',
              };
            }
            return item;
          }),
        }));
      },

      resetInventory: () => {
        set({ items: INITIAL_INVENTORY });
      },
    }),
    {
      name: 'brokole-inventory-storage',
    }
  )
);
