import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useProductStore } from '../store/useProductStore';
import { useOrderStore } from '../store/useOrderStore';

/**
 * Connects the storefront to the database once, at app start:
 *   1. restores the Supabase session (and keeps it in sync),
 *   2. loads the menu from `menu_view` instead of the bundled array,
 *   3. loads this customer's own orders and subscribes to live status changes
 *      pushed by the kitchen console.
 *
 * Step 3 is what makes the two apps feel connected: a status change made in the
 * admin console lands here without a refresh, and vice versa.
 */
export function useAppBootstrap() {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const loadProducts = useProductStore((s) => s.loadProducts);

  useEffect(() => {
    void initialize();
    void loadProducts();
  }, [initialize, loadProducts]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const { loadMyOrders, subscribeToMyOrders } = useOrderStore.getState();
    void loadMyOrders();
    const unsubscribe = subscribeToMyOrders();
    return unsubscribe;
  }, [isLoggedIn]);
}
