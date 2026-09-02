import { create } from 'zustand';
import { Product, SAMPLE_PRODUCTS } from '../lib/shopify';
import { fetchMenu } from '../lib/menu';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * The menu.
 *
 * This used to be a persisted copy of SAMPLE_PRODUCTS in localStorage, which
 * meant every browser held its own private menu and a price change in the admin
 * console never reached anybody. It now loads from the database on mount, so
 * both apps read the same rows. Nothing is persisted — a stale cached menu is
 * worse than a brief loading state.
 */
interface ProductState {
  products: Product[];
  loading: boolean;
  loaded: boolean;
  source: 'database' | 'local';

  loadProducts: () => Promise<void>;

  // Kept for compatibility with the legacy /kitchen screen. Menu editing now
  // belongs to the admin console, where writes are gated by RLS.
  addProduct: (newProduct: Omit<Product, 'id'>) => void;
  deleteProduct: (id: string) => void;
  resetProducts: () => void;
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: SAMPLE_PRODUCTS,
  loading: false,
  loaded: false,
  source: 'local',

  loadProducts: async () => {
    if (get().loading) return;
    set({ loading: true });

    try {
      const products = await fetchMenu();
      set({
        products: products.length > 0 ? products : SAMPLE_PRODUCTS,
        source: isSupabaseConfigured && products.length > 0 ? 'database' : 'local',
        loaded: true,
      });
    } finally {
      set({ loading: false });
    }
  },

  addProduct: (data) => {
    const id = `local-${Date.now()}`;
    set({ products: [{ ...data, id } as Product, ...get().products] });
  },

  deleteProduct: (id) => {
    set({ products: get().products.filter((p) => p.id !== id) });
  },

  resetProducts: () => {
    set({ products: SAMPLE_PRODUCTS, source: 'local', loaded: false });
    void get().loadProducts();
  },
}));
