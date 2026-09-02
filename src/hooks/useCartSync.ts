import { useEffect } from 'react';
import { useCartStore } from '../store/useCartStore';

export function useCartSync() {
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    // Check if user returned from completed checkout via query param e.g. ?checkout=success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout') === 'success' || urlParams.get('order') === 'completed') {
      clearCart();
    }
  }, [clearCart]);
}
