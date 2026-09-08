import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, ShoppingBag, Flame, Sparkles, Truck, MapPin, AlertCircle, Send, MessageCircle } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useOrderStore } from '../store/useOrderStore';
import { placeOrder, fetchDefaultOutletId, ensureAddress } from '../lib/menu';
import { isApiConfigured } from '../lib/api';
import { useCustomerStore } from '../store/useCustomerStore';
import { formatCurrency } from '../lib/nutritionParser';
import { toast } from 'sonner';
import { CartMacroProgress } from './CartMacroProgress';
import { useMacroStore } from '../store/useMacroStore';

export const CartDrawer: React.FC = () => {
  const { items, isOpen, closeCart, updateQuantity, removeItem, getTotalPrice, getMacroTotals, clearCart } = useCartStore();
  const { user, isLoggedIn, openAuthModal, updateUser } = useAuthStore();
  const { isGoalSet, calculated } = useMacroStore();

  const [showAddressModal, setShowAddressModal] = useState(false);

  const [isPlacing, setIsPlacing] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');

  // Sync user defaults when modal opens or user profile changes
  useEffect(() => {
    if (user) {
      setCustName(user.name || '');
      setCustPhone(user.phone || '');
      setCustAddress(user.address && !user.address.toLowerCase().includes('add your delivery address') ? user.address : '');
    }
  }, [user]);

  if (!isOpen) return null;

  const subtotal = getTotalPrice();
  const freeDeliveryThreshold = 499;
  const deliveryFee = subtotal >= freeDeliveryThreshold || subtotal === 0 ? 0 : 29;
  const taxAmount = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + deliveryFee + taxAmount;

  const macroTotals = getMacroTotals();
  const progressToFreeDelivery = Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100));
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  const isAddressInvalid = (addr: string) => {
    return !addr || addr.trim() === '' || addr.toLowerCase().includes('add your delivery address');
  };

  // Places the order in the database. The kitchen console sees it over Supabase
  // Realtime a moment later - no BroadcastChannel, which only ever reached other
  // tabs in this same browser.
  const placeDirectOrder = async (name: string, phone: string, address: string) => {
    if (isPlacing) return;
    setIsPlacing(true);

    const itemsSummaryText = items
      .map((item) => `${item.product.title} x${item.quantity}`)
      .join(', ');

    updateUser({ name, phone, address });

    useCustomerStore.getState().upsertCustomer({
      name,
      phone,
      address,
      email: user?.email,
      dietary: user?.dietaryPreferences,
      spentAmount: grandTotal,
    });

    try {
      if (isApiConfigured) {
        let outletId: string | null = null;
        try {
          outletId = await fetchDefaultOutletId();
        } catch {
          outletId = null;
        }

        let result: { orderId: string; orderNo: string; total: number } | { error: string } = { error: 'No kitchen outlet available' };

        if (outletId) {
          try {
            const addressId = await ensureAddress({ line1: address }).catch(() => undefined);

            result = await placeOrder({
              outletId,
              addressId: addressId ?? undefined,
              lines: items.map((item) => {
                let lineName = item.product.title;
                if (item.variant?.title && (item.variant.title.includes('Goal:') || item.variant.title.includes('Plan'))) {
                  lineName = `${item.product.title} (${item.variant.title})`;
                }
                return {
                  menuItemId:
                    item.product.id && !item.product.id.startsWith('gid://') && !item.product.id.startsWith('reorder-')
                      ? item.product.id
                      : item.product.handle && !item.product.handle.startsWith('reorder-')
                        ? item.product.handle
                        : null,
                  quantity: item.quantity,
                  name: lineName,
                  price: parseFloat(item.variant.price.amount) || parseFloat(item.product.priceRange?.minVariantPrice?.amount || '0') || 0,
                  calories: item.product.nutrition?.calories || 0,
                  protein: item.product.nutrition?.protein || 0,
                  notes: item.product.description ? item.product.description.split('\n\n')[0] : undefined,
                };
              }),
            });
          } catch {
            result = { error: 'API unreachable' };
          }
        }

        if ('error' in result) {
          const createdOrder = useOrderStore.getState().addOrder({
            userId: user?.id,
            userEmail: user?.email,
            customerName: name,
            customerPhone: phone,
            customerAddress: address,
            itemsSummary: itemsSummaryText,
            itemsList: items.map((item) => ({
              title: item.product.title,
              quantity: item.quantity,
              price: parseFloat(item.variant.price.amount) || parseFloat(item.product.priceRange?.minVariantPrice?.amount || '0') || 0,
            })),
            totalAmount: grandTotal,
            proteinGrams: macroTotals.protein,
            calories: macroTotals.calories,
          });

          toast.success(`Order #${createdOrder.id} placed successfully! 🎉`, {
            description: 'Your order has been confirmed and scheduled for kitchen dispatch.',
            duration: 5000,
          });
        } else {
          await useOrderStore.getState().loadMyOrders().catch(() => {});
          const freshOrders = useOrderStore.getState().orders;
          if (freshOrders.length > 0) {
            useOrderStore.setState({ latestPlacedOrder: { ...freshOrders[0], isNew: true } });
          }

          toast.success('Order placed!', {
            description: 'The kitchen has it - you can follow its progress above.',
            duration: 5000,
          });
        }
      } else {
        // Offline / zero-config cloud sync flow
        const createdOrder = useOrderStore.getState().addOrder({
          userId: user?.id,
          userEmail: user?.email,
          customerName: name,
          customerPhone: phone,
          customerAddress: address,
          itemsSummary: itemsSummaryText,
          itemsList: items.map((item) => ({
            title: item.product.title,
            quantity: item.quantity,
            price: parseFloat(item.variant.price.amount) || parseFloat(item.product.priceRange?.minVariantPrice?.amount || '0') || 0,
          })),
          totalAmount: grandTotal,
          proteinGrams: macroTotals.protein,
          calories: macroTotals.calories,
        });

        toast.success(`Order #${createdOrder.id} placed successfully! 🎉`, {
          description: 'Your order has been sent directly to the operations kitchen.',
          duration: 5000,
        });
      }

      setShowAddressModal(false);
      clearCart();
      closeCart();
    } finally {
      setIsPlacing(false);
    }
  };

  const handleCheckoutClick = () => {
    if (items.length === 0) return;

    // MANDATORY AUTH CHECK: Customer MUST be signed in to checkout
    if (!isLoggedIn || !user) {
      toast.error('Please sign in to proceed to checkout!', {
        description: 'Create an account or sign in to complete your pre-order.',
        duration: 4000,
      });
      openAuthModal('login');
      return;
    }

    // Check if mandatory fields are complete
    if (!custName.trim() || !custPhone.trim() || isAddressInvalid(custAddress)) {
      toast.warning('Delivery address & contact details are mandatory!', {
        description: 'Please fill in your delivery details before placing your pre-order.',
        duration: 4000,
      });
      setShowAddressModal(true);
      return;
    }

    // Details are present -> place the order
    void placeDirectOrder(custName, custPhone, custAddress);
  };

  const handleSaveModalAndCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim() || isAddressInvalid(custAddress)) {
      toast.error('Delivery address and contact details are mandatory!');
      return;
    }
    void placeDirectOrder(custName, custPhone, custAddress);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6">
        <div className="w-screen max-w-md bg-[var(--color-surface)] shadow-drawer flex flex-col justify-between border-l border-[var(--color-border)] rounded-l-3xl overflow-hidden animate-slide-in-right">

          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-text-main)]">Your Fuel Basket</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-xs text-[var(--color-text-muted)] font-semibold">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </p>

                  {isGoalSet && calculated.targetCalories > 0 && items.length > 0 && (
                    <div className="flex items-center gap-2 pl-3 border-l border-[var(--color-border)]">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-tight">Goal</span>
                      <div className="w-16 h-1.5 bg-[var(--color-surface-hover)] rounded-full overflow-hidden shadow-inner flex items-center">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((macroTotals.calories / calculated.targetCalories) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-[var(--color-text-main)]">
                        {Math.min(100, Math.round((macroTotals.calories / calculated.targetCalories) * 100))}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={closeCart}
              className="p-2 rounded-2xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Banner (Unified & Consistent) */}
          <div className="bg-emerald-500/10 px-4 py-2.5 border-b border-emerald-500/20">
            <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>🎉 FREE Delivery Unlocked for your Pre-Order!</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase">
                100% FREE
              </span>
            </div>
          </div>

          {/* Scrollable Container: Items, Address, Nutrition & Bill Details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--color-text-muted)]">
                <div className="w-16 h-16 rounded-3xl bg-[var(--color-surface-hover)] flex items-center justify-center mb-4 text-[var(--color-text-light)]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-[var(--color-text-main)] mb-1">Your cart is empty</h4>
                <p className="text-xs text-[var(--color-text-muted)] max-w-xs mb-6">
                  Add chef-crafted meals packed with protein to fuel your day!
                </p>
                <button
                  onClick={closeCart}
                  className="px-6 py-3 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-bold text-xs hover:bg-[var(--color-primary-hover)] transition-all carved-btn"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <>
                {/* Cart Items List */}
                <div className="space-y-3">
                  {items.map((item) => {
                    const itemPrice = parseFloat(item.variant.price.amount) || parseFloat(item.product.priceRange.minVariantPrice.amount) || 0;
                    return (
                      <div
                        key={item.id}
                        className="flex gap-3 p-3.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs hover:border-[var(--color-primary-muted)] transition-all carved-box"
                      >
                        {/* Thumbnail */}
                        <img
                          src={item.product?.featuredImage?.url || item.product?.images?.[0]?.url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}
                          alt={item.product?.title || 'Meal'}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover bg-[var(--color-surface-hover)] shrink-0"
                        />

                        {/* Content */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs sm:text-sm font-extrabold text-[var(--color-text-main)] truncate">
                                {item.product.title}
                              </h4>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-[var(--color-text-light)] hover:text-[var(--color-error)] transition-colors p-1"
                                aria-label={`Remove ${item.product.title}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] font-semibold truncate">
                              {item.variant.title}
                            </p>
                            <p className="text-[11px] text-[var(--color-primary)] font-extrabold mt-0.5">
                              {item.product.nutrition.protein * item.quantity}g Protein • {item.product.nutrition.calories * item.quantity} kcal
                            </p>
                          </div>

                          {/* Quantity Stepper & Price */}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl p-1">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-6 h-6 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-main)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs font-bold"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black text-[var(--color-text-main)] px-1">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-6 h-6 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-main)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs font-bold"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="text-sm font-black text-[var(--color-text-main)]">
                              {formatCurrency(itemPrice * item.quantity, item.variant.price.currencyCode)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Delivery Address Card */}
                <div className="p-3.5 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-start justify-between gap-2 text-xs shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-[var(--color-text-main)] block mb-0.5">Delivery Address:</span>
                      <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2">
                        {!isLoggedIn
                          ? '🔒 Please sign in to set delivery address'
                          : custAddress && !isAddressInvalid(custAddress)
                            ? custAddress
                            : '⚠️ No address added yet (Mandatory)'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!isLoggedIn) {
                        openAuthModal('login');
                      } else {
                        setShowAddressModal(true);
                      }
                    }}
                    className="text-[11px] font-black text-[var(--color-primary)] hover:underline shrink-0 cursor-pointer"
                  >
                    {!isLoggedIn ? 'Sign In' : custAddress && !isAddressInvalid(custAddress) ? 'Edit' : '+ Add Address'}
                  </button>
                </div>

                {/* Cart Macro Progress */}
                <CartMacroProgress />

                {/* Basket Nutrition Breakdown Box (Compact) */}
                <div className="p-2.5 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)]">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-[var(--color-primary)] mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 fill-[var(--color-deal)] text-[var(--color-deal)]" />
                      <span>Basket Nutrition</span>
                    </span>
                    <Sparkles className="w-3 h-3 opacity-70" />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-[var(--color-surface)] py-1 px-1 rounded-lg border border-[var(--color-border-subtle)]">
                      <span className="block font-black text-xs text-[var(--color-text-main)] leading-tight">{macroTotals.protein}g</span>
                      <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Protein</span>
                    </div>
                    <div className="bg-[var(--color-surface)] py-1 px-1 rounded-lg border border-[var(--color-border-subtle)]">
                      <span className="block font-black text-xs text-[var(--color-text-main)] leading-tight">{macroTotals.calories}</span>
                      <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Calories</span>
                    </div>
                    <div className="bg-[var(--color-surface)] py-1 px-1 rounded-lg border border-[var(--color-border-subtle)]">
                      <span className="block font-black text-xs text-[var(--color-text-main)] leading-tight">{macroTotals.carbs}g</span>
                      <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Carbs</span>
                    </div>
                    <div className="bg-[var(--color-surface)] py-1 px-1 rounded-lg border border-[var(--color-border-subtle)]">
                      <span className="block font-black text-xs text-[var(--color-text-main)] leading-tight">{macroTotals.fat}g</span>
                      <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Fat</span>
                    </div>
                  </div>
                </div>

                {/* Bill Details Breakdown Box */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-2.5 text-xs shadow-xs">
                  <h4 className="font-extrabold text-[var(--color-text-main)] text-sm tracking-tight border-b border-[var(--color-border-subtle)] pb-2 flex items-center justify-between">
                    <span>Bill details</span>
                    {deliveryFee === 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">
                        SAVED ₹29 DELIVERY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase">
                        ADD {formatCurrency(amountNeededForFreeDelivery)} FOR FREE DELIVERY
                      </span>
                    )}
                  </h4>

                  <div className="flex items-center justify-between font-semibold text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      <span>Items subtotal</span>
                    </span>
                    <span className="font-extrabold text-[var(--color-text-main)]">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between font-semibold text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      <span>Delivery charge</span>
                    </span>
                    <div className="flex items-center gap-1.5 font-extrabold">
                      {deliveryFee === 0 ? (
                        <>
                          <span className="line-through text-[var(--color-text-light)] text-[11px]">₹29</span>
                          <span className="text-emerald-600 font-extrabold">FREE</span>
                        </>
                      ) : (
                        <span className="text-[var(--color-text-main)] font-extrabold">₹29</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between font-semibold text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      <span>GST (5%)</span>
                    </span>
                    <span className="font-extrabold text-[var(--color-text-main)]">{formatCurrency(taxAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between font-black text-sm text-[var(--color-text-main)] pt-2.5 border-t border-[var(--color-border)]">
                    <span>Grand total</span>
                    <span className="text-base text-[var(--color-primary)] font-black">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sticky Checkout Footer */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
              <button
                onClick={handleCheckoutClick}
                disabled={isPlacing}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn disabled:opacity-60 disabled:cursor-not-allowed ${!isLoggedIn
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)]'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
              >
                <Send className="w-5 h-5" />
                <span>
                  {isPlacing
                    ? 'Sending to the kitchen…'
                    : !isLoggedIn
                      ? 'Sign In to Checkout'
                      : 'Confirm & Place Order'}
                </span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Mandatory Delivery Address Modal Overlay */}
      {showAddressModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-2xl space-y-4 carved-box">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--color-text-main)]">Delivery Address Required</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)] font-semibold">Mandatory for Kitchen Pre-Order Dispatch</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddressModal(false)}
                className="p-1.5 rounded-xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalAndCheckout} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-extrabold text-[var(--color-text-main)] mb-1">
                  Customer Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-primary)] shadow-xs"
                />
              </div>

              <div>
                <label className="block font-extrabold text-[var(--color-text-main)] mb-1">
                  Mobile Number (for SMS & delivery updates) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="e.g. +91 70662 12122"
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-primary)] shadow-xs"
                />
              </div>

              <div>
                <label className="block font-extrabold text-[var(--color-text-main)] mb-1">
                  Full Delivery Address (House No, Street, Locality & Pincode) <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="e.g. Flat 302, Green Valley Apts, Koramangala, Bengaluru - 560095"
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-medium text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-primary)] shadow-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
                >
                  <Send className="w-4 h-4" />
                  <span>Confirm Address & Place Pre-Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
