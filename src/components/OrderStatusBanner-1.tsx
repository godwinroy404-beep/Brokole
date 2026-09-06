import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useOrderStore, OrderStatus } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { isApiConfigured } from '../lib/api';
import { X, ChevronUp, MapPin, Truck, Utensils, Sparkles, CheckCircle2, Clock, Phone, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../lib/nutritionParser';
import { toast } from 'sonner';


/**
 * How long the "Delivered" banner stays up before hiding itself.
 */
const DELIVERED_AUTO_HIDE_MS = 60_000;

/** When we first saw each order as delivered, so a page reload can't reset the clock. */
const FIRST_SEEN_KEY = 'brokole-delivered-first-seen';
/** Orders whose banner has already gone away - persisted so it stays away. */
const DISMISSED_KEY = 'brokole-banner-dismissed';
/** Orders the customer shrank to the small floating button. */
const COMPACT_KEY = 'brokole-banner-compact';

function readJson(key: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Keeps only the 30 most recent entries so this can't grow forever. */
function writeJson(key: string, value: Record<string, number>): void {
  try {
    const trimmed = Object.fromEntries(
      Object.entries(value).sort((a, b) => b[1] - a[1]).slice(0, 30),
    );
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    /* private browsing - the banner just won't remember across reloads */
  }
}

/**
 * Status arrives as either the UI label ("Delivered") or the raw database value
 * ("delivered"), depending on whether the order came from the store or straight
 * off the API. Compare case-insensitively or the timer silently never starts.
 */
function isDelivered(status: unknown): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'delivered' || s.includes('delivered');
}

export const OrderStatusBanner: React.FC = () => {
  const { latestPlacedOrder, orders, clearLatestPlacedOrder } = useOrderStore();
  const { user, isLoggedIn } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  // Was a single id held only in memory, so the banner came back on every
  // reload. Now a persisted set.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set(Object.keys(readJson(DISMISSED_KEY))),
  );

  /**
   * Orders shrunk to the small floating button.
   *
   * Closing the tracker used to remove it outright, so a customer who tapped X
   * to see the page behind it lost any way back to their order. Now X minimises
   * to a dot until the food actually arrives; only a delivered order can be
   * dismissed for good (and that one hides itself after a minute anyway).
   */
  const [compactIds, setCompactIds] = useState<Set<string>>(
    () => new Set(Object.keys(readJson(COMPACT_KEY))),
  );

  const [isCancelling, setIsCancelling] = useState(false);

  const setCompact = useCallback((orderId: string, compact: boolean) => {
    setCompactIds((prev) => {
      const next = new Set(prev);
      if (compact) next.add(orderId);
      else next.delete(orderId);

      const stored = readJson(COMPACT_KEY);
      if (compact) stored[orderId] = Date.now();
      else delete stored[orderId];
      writeJson(COMPACT_KEY, stored);

      return next;
    });
  }, []);

  const dismissOrder = useCallback((orderId: string) => {
    setDismissedIds((prev) => {
      if (prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.add(orderId);
      writeJson(DISMISSED_KEY, { ...readJson(DISMISSED_KEY), [orderId]: Date.now() });
      return next;
    });
    clearLatestPlacedOrder();
    setIsExpanded(false);
  }, [clearLatestPlacedOrder]);

  // Read current route location from TanStack Router
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  // Read active order from latestPlacedOrder or store orders
  const activeOrder = useMemo(() => {
    const isSub = (o: any) =>
      o.channel === 'subscription' ||
      (o.itemsSummary &&
        (o.itemsSummary.toLowerCase().includes('subscription') ||
          o.itemsSummary.toLowerCase().includes('plan'))) ||
      (o.itemsList &&
        o.itemsList.some(
          (item: any) =>
            item.title?.toLowerCase().includes('subscription') ||
            item.title?.toLowerCase().includes('plan')
        ));

    const isExpired = (o: any) => {
      if (!o || dismissedIds.has(o.id)) return true;
      if (!isDelivered(o.status)) return false; // Pending orders are never expired

      const seen = readJson(FIRST_SEEN_KEY);
      const firstSeen = seen[o.id];

      if (firstSeen) {
        return Date.now() - firstSeen > DELIVERED_AUTO_HIDE_MS;
      }

      if (o.createdAt) {
        const createdMs = new Date(o.createdAt).getTime();
        if (!isNaN(createdMs) && Date.now() - createdMs > DELIVERED_AUTO_HIDE_MS) {
          return true;
        }
      }
      return false;
    };

    if (latestPlacedOrder && !isSub(latestPlacedOrder) && !isExpired(latestPlacedOrder)) {
      return latestPlacedOrder;
    }

    if (!orders || orders.length === 0) return null;

    // Filter order matching user and exclude subscription orders
    const matchUser = (o: any) => {
      if (isSub(o)) return false; // DO NOT show subscription orders in live status tracker banner

      if (!user || isApiConfigured) return true;
      return (
        (o.userId && o.userId === user.id) ||
        (o.userEmail && user.email && o.userEmail.toLowerCase() === user.email.toLowerCase()) ||
        (o.customerName && user.name && o.customerName.toLowerCase() === user.name.toLowerCase()) ||
        o.customerName === 'You'
      );
    };

    const userOrders = orders.filter(matchUser);
    const pending = userOrders.find((o) => !isDelivered(o.status));
    if (pending) return pending;

    const lastDelivered = userOrders.find((o) => isDelivered(o.status) && !isExpired(o));
    return lastDelivered ?? null;
  }, [orders, latestPlacedOrder, user, dismissedIds]);

  // Expand automatically when a fresh new order is placed
  useEffect(() => {
    if (latestPlacedOrder && latestPlacedOrder.isNew) {
      setIsExpanded(true);
    }
  }, [latestPlacedOrder]);

  /**
   * Hide the banner one minute after the order is delivered.
   *
   * Two things this has to get right, both of which broke the previous version:
   *
   * 1. The dependency list is the order's ID and delivered-ness, NOT the order
   *    object. Polling replaces `orders` with freshly-built objects every 6
   *    seconds, so depending on `activeOrder` meant the cleanup ran and the
   *    timeout was recreated on every poll - the 60s never elapsed.
   *
   * 2. The countdown starts when the order was FIRST seen as delivered, not
   *    when this component mounted. Otherwise a page reload at 0:59 restarts
   *    the whole minute.
   */
  const activeOrderId = activeOrder?.id ?? null;
  const activeDelivered = isDelivered(activeOrder?.status);

  useEffect(() => {
    if (!activeOrderId || !activeDelivered) return;
    if (dismissedIds.has(activeOrderId)) return;

    const seen = readJson(FIRST_SEEN_KEY);
    let firstSeen = seen[activeOrderId];

    if (!firstSeen) {
      firstSeen = Date.now();
      writeJson(FIRST_SEEN_KEY, { ...seen, [activeOrderId]: firstSeen });
    }

    const remaining = DELIVERED_AUTO_HIDE_MS - (Date.now() - firstSeen);

    if (remaining <= 0) {
      dismissOrder(activeOrderId);
      return;
    }

    const timer = setTimeout(() => dismissOrder(activeOrderId), remaining);
    return () => clearTimeout(timer);
  }, [activeOrderId, activeDelivered, dismissedIds, dismissOrder]);

  // HIDE IF NO ORDER PLACED or on kitchen admin page
  if (pathname.startsWith('/kitchen') || !activeOrder || dismissedIds.has(activeOrder.id)) {
    return null;
  }

  // A finished order always shows the full bar for its last minute, so the
  // customer sees "Delivered" rather than a dot that silently disappears.
  const isCompact = compactIds.has(activeOrder.id) && !isDelivered(activeOrder.status);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Finished orders can be cleared away; anything still in flight only
    // shrinks, so the customer always has a way back to it.
    if (isDelivered(activeOrder.status)) {
      dismissOrder(activeOrder.id);
      return;
    }

    setCompact(activeOrder.id, true);
    setIsExpanded(false);
  };

  const getStatusDetails = (status: OrderStatus | string) => {
    const s = (status || '').toLowerCase().trim();

    if (s === 'placed' || s === 'paid' || s === 'new order' || s === 'pre-order scheduled' || s === 'draft') {
      return {
        label: 'Order Confirmed',
        desc: 'Kitchen received your order',
        step: 1,
        lineColor: 'bg-emerald-500',
        badgeColor: 'bg-emerald-500 text-white',
        dotColor: 'bg-emerald-500',
        activeCircleBg: 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110 shadow-md',
        scooterMode: 'idle',
      };
    }

    if (s === 'accepted' || s === 'in_kitchen' || s === 'packed' || s === 'preparing') {
      return {
        label: 'Preparing in Kitchen',
        desc: 'Chef is cooking your fresh meal',
        step: 2,
        lineColor: 'bg-amber-500',
        badgeColor: 'bg-amber-500 text-white',
        dotColor: 'bg-amber-500',
        activeCircleBg: 'bg-amber-500 text-white ring-4 ring-amber-100 scale-110 shadow-md',
        scooterMode: 'kitchen',
      };
    }

    if (s === 'out_for_delivery' || s === 'out for delivery') {
      return {
        label: 'Out for Delivery',
        desc: 'Rider is on the way (~15 mins)',
        step: 3,
        lineColor: 'bg-indigo-600',
        badgeColor: 'bg-indigo-600 text-white',
        dotColor: 'bg-indigo-500',
        activeCircleBg: 'bg-indigo-600 text-white ring-4 ring-indigo-100 scale-110 shadow-md',
        scooterMode: 'riding',
      };
    }

    if (s === 'delivered') {
      return {
        label: 'Delivered Fresh 🎉',
        desc: 'Enjoy your healthy meal!',
        step: 4,
        lineColor: 'bg-emerald-600',
        badgeColor: 'bg-emerald-600 text-white',
        dotColor: 'bg-emerald-500',
        activeCircleBg: 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110 shadow-md',
        scooterMode: 'delivered',
      };
    }

    return {
      label: 'Order Placed',
      desc: 'Processing order details',
      step: 1,
      lineColor: 'bg-emerald-500',
      badgeColor: 'bg-emerald-500 text-white',
      dotColor: 'bg-emerald-500',
      activeCircleBg: 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110 shadow-md',
      scooterMode: 'idle',
    };
  };

  const statusInfo = getStatusDetails(activeOrder.status);

  return (
    <>
      {/* Minimised: a small dot the customer can tap to get back to the order */}
      {isCompact ? (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40">
          <button
            onClick={() => setIsExpanded(true)}
            title={`${activeOrder.id} - ${statusInfo.label}`}
            aria-label={`Order ${activeOrder.id}, ${statusInfo.label}. Open tracker.`}
            className="relative grid size-14 place-items-center rounded-full bg-neutral-900/95 text-white shadow-2xl border border-neutral-700/80 backdrop-blur-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span className="text-xl leading-none select-none">
              {statusInfo.scooterMode === 'riding'
                ? '🛵'
                : statusInfo.scooterMode === 'kitchen'
                  ? '🍳'
                  : statusInfo.scooterMode === 'delivered'
                    ? '🎉'
                    : '🧾'}
            </span>

            {/* Live status dot, so the button says something even while collapsed */}
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusInfo.dotColor} opacity-75`} />
              <span className={`relative inline-flex size-3.5 rounded-full ${statusInfo.dotColor} ring-2 ring-neutral-900`} />
            </span>
          </button>
        </div>
      ) : (
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
      )}

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
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
                  title="Dismiss Tracker"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Step Progress Line */}
            <div className="py-3 px-1">
              <div className="flex items-center justify-between relative px-2">
                {/* Background Connecting Line */}
                <div className="absolute left-6 right-6 top-4 h-1 bg-neutral-200 -z-0 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${statusInfo.lineColor} transition-all duration-500`}
                    style={{ width: `${((statusInfo.step - 1) / 3) * 100}%` }}
                  />
                </div>

                {[
                  { s: 1, label: 'Placed', icon: Clock },
                  { s: 2, label: 'Kitchen', icon: Utensils },
                  { s: 3, label: 'Rider', icon: Truck },
                  { s: 4, label: 'Delivered', icon: CheckCircle2 },
                ].map((st) => {
                  const isCompleted = statusInfo.step > st.s;
                  const isCurrent = statusInfo.step === st.s;
                  const Icon = st.icon;
                  return (
                    <div key={st.s} className="flex flex-col items-center gap-1.5 z-10">
                      <div
                        className={`size-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                          isCurrent
                            ? statusInfo.activeCircleBg
                            : isCompleted
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <span
                        className={`text-[11px] transition-colors ${
                          isCurrent
                            ? 'font-black text-neutral-900 scale-105'
                            : isCompleted
                            ? 'font-bold text-neutral-800'
                            : 'font-semibold text-neutral-400'
                        }`}
                      >
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
            {(() => {
              const statusLower = (activeOrder?.status || '').toLowerCase();
              const isPackedOrBeyond =
                statusLower.includes('packed') ||
                statusLower.includes('rider') ||
                statusLower.includes('out_for_delivery') ||
                statusLower.includes('out for delivery') ||
                statusLower.includes('delivered') ||
                statusLower.includes('cancelled') ||
                statusLower.includes('refunded');

              const isCancellable = activeOrder && !isPackedOrBeyond;

              const handleCancelOrder = async () => {
                if (!activeOrder || isCancelling) return;
                if (window.confirm(`Are you sure you want to cancel order #${activeOrder.id}?`)) {
                  setIsCancelling(true);
                  const res = await useOrderStore.getState().cancelUserOrder(activeOrder.id, 'Cancelled by customer via tracker');
                  setIsCancelling(false);
                  if (res.ok) {
                    toast.success(`Order #${activeOrder.id} cancelled successfully`);
                    setIsExpanded(false);
                  } else {
                    toast.error(res.error || 'Could not cancel order');
                  }
                }
              };

              return (
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  {isCancellable && (
                    <button
                      type="button"
                      onClick={handleCancelOrder}
                      disabled={isCancelling}
                      className="w-full sm:w-1/2 py-2.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition text-center shadow-2xs cursor-pointer disabled:opacity-60"
                    >
                      {isCancelling ? 'Cancelling…' : 'Cancel Order'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setCompact(activeOrder.id, false);
                      setIsExpanded(false);
                    }}
                    className={`w-full ${isCancellable ? 'sm:w-1/2' : 'w-full'} py-2.5 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition text-center shadow-xs cursor-pointer`}
                  >
                    Minimize Tracker
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
};
