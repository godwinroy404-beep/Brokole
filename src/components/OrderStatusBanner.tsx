import React, { useState, useMemo, useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useOrderStore, OrderStatus } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { X, ChevronUp, MapPin, Truck, Utensils, Sparkles, CheckCircle2, Clock, Phone, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../lib/nutritionParser';

export const OrderStatusBanner: React.FC = () => {
  const { latestPlacedOrder, orders, clearLatestPlacedOrder } = useOrderStore();
  const { user, isLoggedIn } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  // Read current route location from TanStack Router
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  // Read active order from latestPlacedOrder or store orders
  const activeOrder = useMemo(() => {
    if (latestPlacedOrder && latestPlacedOrder.id !== dismissedId) {
      return latestPlacedOrder;
    }

    if (!orders || orders.length === 0) return null;

    // Filter order matching user or latest order
    const matchUser = (o: any) => {
      if (!user) return true; // show latest order if guest or in local demo
      return (
        (o.userId && o.userId === user.id) ||
        (o.userEmail && user.email && o.userEmail.toLowerCase() === user.email.toLowerCase()) ||
        (o.customerName && user.name && o.customerName.toLowerCase() === user.name.toLowerCase())
      );
    };

    const userOrders = orders.filter(matchUser);
    const pending = userOrders.find((o) => o.status !== 'Delivered');
    return pending || (userOrders.length > 0 ? userOrders[0] : null);
  }, [orders, latestPlacedOrder, user, dismissedId]);

  // Expand automatically when a fresh new order is placed
  useEffect(() => {
    if (latestPlacedOrder && latestPlacedOrder.isNew) {
      setIsExpanded(true);
    }
  }, [latestPlacedOrder]);

  // HIDE IF NO ORDER PLACED or on kitchen admin page
  if (pathname.startsWith('/kitchen') || !activeOrder || activeOrder.id === dismissedId) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedId(activeOrder.id);
    clearLatestPlacedOrder();
    setIsExpanded(false);
  };

  const getStatusDetails = (status: OrderStatus) => {
    switch (status) {
      case 'New Order':
      case 'Pre-Order Scheduled':
        return {
          label: 'Order Confirmed',
          desc: 'Kitchen received your order',
          step: 1,
          badgeColor: 'bg-emerald-500 text-white',
          dotColor: 'bg-emerald-500',
          scooterMode: 'idle',
        };
      case 'Preparing':
        return {
          label: 'Preparing in Kitchen',
          desc: 'Chef is cooking your fresh meal',
          step: 2,
          badgeColor: 'bg-amber-500 text-white',
          dotColor: 'bg-amber-500',
          scooterMode: 'kitchen',
        };
      case 'Out for Delivery':
        return {
          label: 'Out for Delivery',
          desc: 'Rider is on the way (~15 mins)',
          step: 3,
          badgeColor: 'bg-indigo-600 text-white',
          dotColor: 'bg-indigo-500',
          scooterMode: 'riding',
        };
      case 'Delivered':
        return {
          label: 'Delivered Fresh 🎉',
          desc: 'Enjoy your healthy meal!',
          step: 4,
          badgeColor: 'bg-emerald-600 text-white',
          dotColor: 'bg-emerald-500',
          scooterMode: 'delivered',
        };
      default:
        return {
          label: 'Order Placed',
          desc: 'Processing order details',
          step: 1,
          badgeColor: 'bg-emerald-500 text-white',
          dotColor: 'bg-emerald-500',
          scooterMode: 'idle',
        };
    }
  };

  const statusInfo = getStatusDetails(activeOrder.status);

  return (
    <>
      {/* Floating Status Button (Fixed at Bottom Right) */}
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 animate-bounce-subtle">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 bg-neutral-900/95 text-white pl-3.5 pr-4 py-2.5 rounded-full shadow-2xl border border-neutral-700/80 backdrop-blur-md hover:bg-neutral-800 transition-all transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer group"
        >
          {/* Pulsing Status Dot */}
          <span className="relative flex size-3 shrink-0">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusInfo.dotColor} opacity-75`}></span>
            <span className={`relative inline-flex size-3 rounded-full ${statusInfo.dotColor}`}></span>
          </span>

          {/* Animated Scooter / Icon */}
          <div className="flex items-center gap-1 bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700 text-xs shrink-0">
            <span className="text-sm select-none">🛵</span>
            {statusInfo.scooterMode === 'riding' ? (
              <span className="text-[10px] text-amber-300 font-black animate-pulse">💨</span>
            ) : statusInfo.scooterMode === 'kitchen' ? (
              <span className="text-xs select-none">🍳</span>
            ) : statusInfo.scooterMode === 'delivered' ? (
              <span className="text-xs select-none">🎉</span>
            ) : (
              <span className="text-[10px] text-emerald-300 font-bold">✓</span>
            )}
          </div>

          {/* Order ID & Status Label */}
          <div className="text-left leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-bold text-neutral-300">{activeOrder.id}</span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
            <div className="text-xs font-bold text-white group-hover:text-brand-300 transition">
              {statusInfo.label}
            </div>
          </div>

          <ChevronUp className={`size-4 text-neutral-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded Order Tracking Modal / Sheet */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl p-5 shadow-2xl space-y-4 animate-slide-up">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-neutral-900">{activeOrder.id}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusInfo.badgeColor}`}>
                    {activeOrder.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5 font-medium">{statusInfo.desc}</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleDismiss}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
                  title="Dismiss Tracker"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Step Progress Line */}
            <div className="py-2">
              <div className="flex items-center justify-between relative px-2">
                {/* Background Connecting Line */}
                <div className="absolute left-6 right-6 top-4 h-0.5 bg-neutral-200 -z-0">
                  <div
                    className="h-full bg-brand-600 transition-all duration-500"
                    style={{ width: `${((statusInfo.step - 1) / 3) * 100}%` }}
                  />
                </div>

                {[
                  { s: 1, label: 'Placed', icon: Clock },
                  { s: 2, label: 'Kitchen', icon: Utensils },
                  { s: 3, label: 'Rider', icon: Truck },
                  { s: 4, label: 'Delivered', icon: CheckCircle2 },
                ].map((st) => {
                  const isActive = statusInfo.step >= st.s;
                  const isCurrent = statusInfo.step === st.s;
                  const Icon = st.icon;
                  return (
                    <div key={st.s} className="flex flex-col items-center gap-1.5 z-10">
                      <div
                        className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCurrent
                            ? 'bg-brand-600 text-white ring-4 ring-brand-100 scale-110 shadow-sm'
                            : isActive
                            ? 'bg-brand-600 text-white'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <span className={`text-[10px] font-bold ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Details Card */}
            <div className="rounded-2xl bg-neutral-50 p-3.5 border border-neutral-100 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600 font-medium">
                <span>Items:</span>
                <span className="font-semibold text-neutral-900 truncate max-w-[220px]">
                  {activeOrder.itemsSummary || 'Healthy Meals'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 font-medium">
                <span>Total Amount:</span>
                <span className="font-bold text-brand-700">{formatCurrency(activeOrder.totalAmount)}</span>
              </div>
              <div className="flex items-start gap-1.5 text-neutral-600 pt-1.5 border-t border-neutral-200/60">
                <MapPin className="size-3.5 text-brand-600 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{activeOrder.customerAddress}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setIsExpanded(false)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition text-center shadow-xs"
              >
                Minimize Tracker
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
