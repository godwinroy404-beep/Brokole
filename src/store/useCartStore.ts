import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, ProductVariant, createShopifyCart, addShopifyCartLines, updateShopifyCartLines, removeShopifyCartLines } from '../lib/shopify';

export interface CartItem {
  id: string; // unique item id (e.g. variantId)
  product: Product;
  variant: ProductVariant;
  quantity: number;
  lineId?: string; // Shopify cart line id
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  shopifyCartId: string | null;
  shopifyCheckoutUrl: string | null;
  isLoading: boolean;

  // Actions
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => void;

  // Computed values
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getMacroTotals: () => { calories: number; protein: number; carbs: number; fat: number };
  getCheckoutUrl: () => string;
}

// Helper function to scale nutrition based on variant portion size
export const scaleNutritionForVariant = (baseNutrition: any, variantTitle: string): typeof baseNutrition => {
  if (!baseNutrition) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const titleLower = (variantTitle || '').toLowerCase();
  let mult = 1.0;
  if (titleLower.includes('medium') || titleLower.includes('standard') || titleLower.includes('350g')) {
    mult = 1.25;
  } else if (titleLower.includes('large') || titleLower.includes('500ml') || titleLower.includes('400g') || titleLower.includes('pro')) {
    mult = 1.5;
  }

  return {
    ...baseNutrition,
    calories: Math.round((baseNutrition.calories || 0) * mult),
    protein: Math.round((baseNutrition.protein || 0) * mult),
    carbs: Math.round((baseNutrition.carbs || 0) * mult),
    fat: Math.round((baseNutrition.fat || 0) * mult),
    fiber: baseNutrition.fiber ? Math.round(baseNutrition.fiber * mult) : undefined,
  };
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      shopifyCartId: null,
      shopifyCheckoutUrl: null,
      isLoading: false,

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: async (product, selectedVariant, quantity = 1) => {
        const variant = selectedVariant || product.variants[0] || {
          id: `${product.id}-default`,
          title: 'Standard Portion',
          price: product.priceRange.minVariantPrice,
          availableForSale: true,
        };

        const scaledProduct: Product = {
          ...product,
          nutrition: scaleNutritionForVariant(product.nutrition, variant.title),
        };

        const existingItemIndex = get().items.findIndex((item) => item.variant.id === variant.id);
        let updatedItems: CartItem[] = [];

        if (existingItemIndex > -1) {
          updatedItems = get().items.map((item, index) => {
            if (index === existingItemIndex) {
              return { ...item, quantity: item.quantity + quantity };
            }
            return item;
          });
        } else {
          updatedItems = [
            ...get().items,
            {
              id: variant.id,
              product: scaledProduct,
              variant,
              quantity,
            },
          ];
        }

        set({ items: updatedItems });

        // Sync with Shopify Storefront API if configured
        try {
          const state = get();
          const lines = [{ merchandiseId: variant.id, quantity }];
          if (!state.shopifyCartId) {
            const newCart = await createShopifyCart(lines);
            if (newCart) {
              set({
                shopifyCartId: newCart.id,
                shopifyCheckoutUrl: newCart.checkoutUrl,
                items: updatedItems.map((item) => {
                  const match = newCart.lines.find((l) => l.merchandise.id === item.variant.id);
                  return match ? { ...item, lineId: match.id } : item;
                }),
              });
            }
          } else {
            const updatedCart = await addShopifyCartLines(state.shopifyCartId, lines);
            if (updatedCart) {
              set({
                shopifyCheckoutUrl: updatedCart.checkoutUrl,
                items: updatedItems.map((item) => {
                  const match = updatedCart.lines.find((l) => l.merchandise.id === item.variant.id);
                  return match ? { ...item, lineId: match.id } : item;
                }),
              });
            }
          }
        } catch (e) {
          console.warn('Shopify cart sync error:', e);
        }
      },

      updateQuantity: async (itemId, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(itemId);
          return;
        }

        const targetItem = get().items.find((i) => i.id === itemId);
        const updatedItems = get().items.map((item) => (item.id === itemId ? { ...item, quantity } : item));
        set({ items: updatedItems });

        // Shopify sync
        const state = get();
        if (state.shopifyCartId && targetItem?.lineId) {
          try {
            const updatedCart = await updateShopifyCartLines(state.shopifyCartId, [{ id: targetItem.lineId, quantity }]);
            if (updatedCart) {
              set({ shopifyCheckoutUrl: updatedCart.checkoutUrl });
            }
          } catch (e) {
            console.warn('Shopify cart update error:', e);
          }
        }
      },

      removeItem: async (itemId) => {
        const targetItem = get().items.find((i) => i.id === itemId);
        const updatedItems = get().items.filter((item) => item.id !== itemId);
        set({ items: updatedItems });

        const state = get();
        if (state.shopifyCartId && targetItem?.lineId) {
          try {
            const updatedCart = await removeShopifyCartLines(state.shopifyCartId, [targetItem.lineId]);
            if (updatedCart) {
              set({ shopifyCheckoutUrl: updatedCart.checkoutUrl });
            }
          } catch (e) {
            console.warn('Shopify cart remove error:', e);
          }
        }
      },

      clearCart: () => set({ items: [], shopifyCartId: null, shopifyCheckoutUrl: null }),

      getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),

      getTotalPrice: () =>
        get().items.reduce((total, item) => {
          const price = parseFloat(item.variant.price.amount) || parseFloat(item.product.priceRange.minVariantPrice.amount) || 0;
          return total + price * item.quantity;
        }, 0),

      getMacroTotals: () =>
        get().items.reduce(
          (acc, item) => {
            const mult = item.quantity;
            return {
              calories: acc.calories + (item.product.nutrition.calories || 0) * mult,
              protein: acc.protein + (item.product.nutrition.protein || 0) * mult,
              carbs: acc.carbs + (item.product.nutrition.carbs || 0) * mult,
              fat: acc.fat + (item.product.nutrition.fat || 0) * mult,
            };
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        ),

      getCheckoutUrl: () => {
        const state = get();
        if (state.shopifyCheckoutUrl) {
          const url = new URL(state.shopifyCheckoutUrl);
          url.searchParams.set('channel', 'online_store');
          return url.toString();
        }
        // Fallback checkout link for seed mode
        return `https://checkout.shopify.com?channel=online_store&items=${encodeURIComponent(
          JSON.stringify(
            state.items.map((i) => ({
              id: i.variant.id,
              quantity: i.quantity,
            }))
          )
        )}`;
      },
    }),
    {
      name: 'brokole-cart-storage',
      partialize: (state) => ({
        items: state.items,
        shopifyCartId: state.shopifyCartId,
        shopifyCheckoutUrl: state.shopifyCheckoutUrl,
      }),
    }
  )
);

