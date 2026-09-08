import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useOrderStore, OrderStatus } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { isApiConfigured } from '../lib/api';
import { X, ChevronUp, MapPin, Truck, Utensils, CheckCircle2, Clock, AlertCircle, Ban, MoreVertical, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../lib/nutritionParser';
import { toast } from 'sonner';

/**
 * How long the "Delivered" or "Cancelled" banner stays up before hiding itself automatically.
 */
const DELIVERED_AUTO_HIDE_MS = 3_500;

/** When we first saw each order as completed/cancelled, so a page reload can't reset the clock. */
const FIRST_SEEN_KEY = 'brokole-delivered-first-seen';
/** Orders whose banner has already gone away - persisted so it stays away. */
const DISMISSED_KEY = 'brokole-banner-dismissed';

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

function isCancelled(status: unknown): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'cancelled' || s === 'canceled' || s === 'refunded' || s.includes('cancel');
}

function isDelivered(status: unknown): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'delivered' || s.includes('delivered') || s === 'completed' || s === 'fulfilled';
}

function isDone(status: unknown): boolean {
  return isDelivered(status) || isCancelled(status);
}

export const OrderStatusBanner: React.FC = () => {
  const { latestPlacedOrder, orders, clearLatestPlacedOrder } = useOrderStore();
  const { user } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [pillJustWiggled, setPillJustWiggled] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set(Object.keys(readJson(DISMISSED_KEY))),
  );

  const userMinimizedRef = React.useRef<Set<string>>(new Set());
  const expandedOrdersRef = React.useRef<Set<string>>(new Set());

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
    setIsMinimizing(false);
  }, [clearLatestPlacedOrder]);

  const [isCancelling, setIsCancelling] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);

  // Keep dismissed IDs in sync with localStorage and real-time events
  useEffect(() => {
    const handleSync = () => {
      setDismissedIds(new Set(Object.keys(readJson(DISMISSED_KEY))));
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('bkl-orders-updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('bkl-orders-updated', handleSync);
    };
  }, []);

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
      if (!o) return true;
      if (dismissedIds.has(o.id) || (o.serverId && dismissedIds.has(o.serverId))) return true;
      if (isCancelled(o.status)) return true; // Cancelled orders do not show delivery tracker
      if (!isDone(o.status)) return false; // Active in-progress orders are never expired

      const seen = readJson(FIRST_SEEN_KEY);
      const firstSeen = seen[o.id] || (o.serverId ? seen[o.serverId] : undefined);

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

    if (!latestPlacedOrder) return null;
    if (isSub(latestPlacedOrder)) return null;
    if (isCancelled(latestPlacedOrder.status)) return null;
    if (dismissedIds.has(latestPlacedOrder.id) || (latestPlacedOrder.serverId && dismissedIds.has(latestPlacedOrder.serverId))) return null;
    if (isExpired(latestPlacedOrder)) return null;

    // Check if the current placed order has live status updates in the orders store
    const liveMatch = orders.find(
      (o) => o.id === latestPlacedOrder.id || (latestPlacedOrder.serverId && (o.serverId === latestPlacedOrder.serverId || o.id === latestPlacedOrder.serverId))
    );

    const targetOrder = liveMatch || latestPlacedOrder;
    if (isCancelled(targetOrder.status)) return null;
    if (dismissedIds.has(targetOrder.id) || (targetOrder.serverId && dismissedIds.has(targetOrder.serverId))) return null;
    if (isExpired(targetOrder)) return null;

    return targetOrder;
  }, [orders, latestPlacedOrder, user, dismissedIds]);

  // Expand smoothly with a gentle delay when a fresh new order is first placed
  useEffect(() => {
    if (latestPlacedOrder?.id && latestPlacedOrder.isNew) {
      if (!expandedOrdersRef.current.has(latestPlacedOrder.id) && !userMinimizedRef.current.has(latestPlacedOrder.id)) {
        expandedOrdersRef.current.add(latestPlacedOrder.id);
        // Clear isNew flag to avoid re-triggering
        useOrderStore.setState((state) => ({
          latestPlacedOrder: state.latestPlacedOrder ? { ...state.latestPlacedOrder, isNew: false } : null,
        }));

        const timer = setTimeout(() => {
          if (!userMinimizedRef.current.has(latestPlacedOrder.id)) {
            setIsExpanded(true);
          }
        }, 750);

        return () => clearTimeout(timer);
      }
    }
  }, [latestPlacedOrder]);

  const activeOrderId = activeOrder?.id ?? null;
  const activeDone = isDone(activeOrder?.status);

  useEffect(() => {
    if (!activeOrderId || !activeDone) return;
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
  }, [activeOrderId, activeDone, dismissedIds, dismissOrder]);

  // HIDE IF NO ORDER PLACED, or order is cancelled/dismissed, or on kitchen admin page
  if (
    pathname.startsWith('/kitchen') ||
    !activeOrder ||
    dismissedIds.has(activeOrder.id) ||
    (activeOrder.serverId && dismissedIds.has(activeOrder.serverId)) ||
    isCancelled(activeOrder.status)
  ) {
    return null;
  }

  const handleMinimize = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeOrder?.id) {
      userMinimizedRef.current.add(activeOrder.id);
    }
    setShowDropdown(false);
    setIsMinimizing(true);
    setTimeout(() => {
      setIsExpanded(false);
      setIsMinimizing(false);
      setPillJustWiggled(true);
      setTimeout(() => setPillJustWiggled(false), 2400);
    }, 270);
  };

  const getStatusDetails = (status: OrderStatus | string) => {
    const s = (status || '').toLowerCase().trim();

    if (isCancelled(s)) {
      return {
        label: 'Order Cancelled',
        desc: 'This order was cancelled',
        step: 0,
        lineColor: 'bg-rose-500',
        badgeColor: 'bg-rose-600 text-white',
        dotColor: 'bg-rose-500',
        activeCircleBg: 'bg-rose-600 text-white ring-4 ring-rose-100 scale-110 shadow-md',
        scooterMode: 'cancelled',
      };
    }

    if (isDelivered(s)) {
      return {
        label: 'Delivered Fresh 🎉',
        desc: 'Order delivered successfully! Enjoy your meal.',
        step: 4,
        lineColor: 'bg-emerald-600',
        badgeColor: 'bg-emerald-600 text-white',
        dotColor: 'bg-emerald-500',
        activeCircleBg: 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110 shadow-md',
        scooterMode: 'delivered',
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
  };

  const statusInfo = getStatusDetails(activeOrder.status);
  const isCancellable = activeOrder && !isDone(activeOrder.status);

  const handleCancelOrder = async () => {
    if (!activeOrder || isCancelling) return;
    const targetId = activeOrder.id;
    setIsCancelling(true);
    const res = await useOrderStore.getState().cancelUserOrder(targetId, 'Cancelled by customer via tracker');
    setIsCancelling(false);
    if (res.ok) {
      toast.success(`Order #${targetId} cancelled successfully`);
      dismissOrder(targetId);
    } else {
      toast.error(res.error || 'Could not cancel order');
    }
  };

  const handleForceCancelOrder = async () => {
    if (!activeOrder || isCancelling) return;
    const targetId = activeOrder.id;
    setIsCancelling(true);
    const res = await useOrderStore.getState().forceCancelUserOrder(targetId, 'Force cancelled by customer via CANCEL ORDER button');
    setIsCancelling(false);
    if (res.ok) {
      toast.success(`Order #${targetId} CANCELLED`);
      dismissOrder(targetId);
    } else {
      toast.error(res.error || 'Could not cancel order');
    }
  };

  return (
    <>
      {/* Floating Status Button (Fixed at Bottom Right) */}
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end pointer-events-none">
        {pillJustWiggled && (
          <div className="animate-fade-in bg-neutral-900 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 mb-2 border border-emerald-500/40 pointer-events-auto">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span>🎯 Tracker minimized here · Tap anytime!</span>
          </div>
        )}
        <button
          onClick={() => {
            if (isExpanded) {
              handleMinimize();
            } else {
              setIsExpanded(true);
            }
          }}
          className={`pointer-events-auto flex items-center gap-3 bg-white text-neutral-900 pl-3.5 pr-4 py-2.5 rounded-full shadow-2xl border-2 transition-all transform active:scale-95 cursor-pointer group ${
            pillJustWiggled
              ? 'animate-pill-wiggle border-emerald-500 ring-4 ring-emerald-200/80 scale-105 shadow-emerald-500/20'
              : 'border-neutral-200/90 hover:border-neutral-300 hover:scale-[1.03]'
          }`}
        >
          {/* Pulsing Status Dot */}
          <span className="relative flex size-3 shrink-0">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusInfo.dotColor} opacity-75`}></span>
            <span className={`relative inline-flex size-3 rounded-full ${statusInfo.dotColor}`}></span>
          </span>

          {/* Animated Scooter Delivery Image */}
          <div className="flex items-center justify-center size-8 bg-transparent overflow-visible shrink-0 relative">
            <img
              src="/images/scooter.gif"
              alt="Delivery Scooter"
              className="w-9 h-9 max-w-none object-contain pointer-events-none"
              onError={(e) => {
                // Fallback if image fails to load
                (e.currentTarget as HTMLImageElement).src = '/scooter.gif';
              }}
            />
          </div>

          {/* Order ID & Status Label */}
          <div className="text-left leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-bold text-neutral-500">{activeOrder.id}</span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusInfo.scooterMode === 'cancelled' ? 'text-rose-600' : 'text-emerald-600'
                }`}>
              {statusInfo.scooterMode === 'cancelled' ? 'Cancelled' : statusInfo.scooterMode === 'delivered' ? 'Done' : 'Live'}
              </span>
            </div>
            <div className="text-xs font-black text-neutral-900 group-hover:text-emerald-600 transition">
              {statusInfo.label}
            </div>
          </div>

          <ChevronUp className={`size-4 text-neutral-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded Order Tracking Modal / Sheet with Jelly Whoosh Transition */}
      {(isExpanded || isMinimizing) && (
        <div
          onClick={handleMinimize}
          className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300 cursor-pointer ${
            isMinimizing ? 'opacity-0' : 'opacity-100 animate-fade-in'
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md bg-white border border-neutral-200 rounded-3xl p-5 shadow-2xl space-y-4 cursor-default ${
              isMinimizing ? 'animate-jelly-minimize' : 'animate-jelly-expand'
            }`}
          >
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

              <div className="flex items-center gap-1.5 relative">
                {/* 3-Dot Options Dropdown Button */}
                {!isDone(activeOrder.status) && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDropdown((prev) => !prev);
                      }}
                      className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition cursor-pointer flex items-center justify-center border border-neutral-200 bg-neutral-50"
                      title="Order options menu"
                    >
                      <MoreVertical className="size-4" />
                    </button>

                    {/* Dropdown Menu Popup */}
                    {showDropdown && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-neutral-200 rounded-2xl shadow-xl z-30 py-1 overflow-hidden animate-scale-in">
                        {isCancellable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDropdown(false);
                              setShowCancelConfirmModal(true);
                            }}
                            disabled={isCancelling}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <Ban className="size-4 text-neutral-400 shrink-0" />
                            <span>{isCancelling ? 'cancelling…' : 'cancel order'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShowDropdown(false);
                            await handleForceCancelOrder();
                          }}
                          disabled={isCancelling}
                          className="w-full px-3.5 py-2.5 text-left text-xs font-black text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 border-t border-neutral-100"
                        >
                          <Ban className="size-4 text-rose-500 shrink-0" />
                          <span>{isCancelling ? 'Cancelling…' : 'CANCEL ORDER'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleMinimize}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
                  title="Close Tracker Popup"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Step Progress Line */}
            <div className="py-2.5 px-1">
              <div className="flex items-center justify-between relative px-2">
                {/* Background Connecting Line */}
                <div className="absolute left-6 right-6 top-4.5 h-0.5 bg-neutral-200 -z-0 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${statusInfo.lineColor} transition-all duration-500`}
                    style={{
                      width:
                        statusInfo.step === 0
                          ? '0%'
                          : statusInfo.step === 4
                            ? '100%'
                            : `${((statusInfo.step - 1) / 3) * 100}%`,
                    }}
                  />
                </div>

                {[
                  { s: 1, label: 'Placed', icon: Clock },
                  { s: 2, label: 'Kitchen', icon: Utensils },
                  { s: 3, label: 'Rider', icon: Truck },
                  { s: 4, label: 'Delivered', icon: CheckCircle2 },
                ].map((st) => {
                  const isCompleted = statusInfo.step > st.s || statusInfo.step === 4;
                  const isCurrent = statusInfo.step === st.s && statusInfo.step !== 4;
                  const isCancelledState = statusInfo.step === 0;
                  const hasGif = true;

                  return (
                    <div key={st.s} className="flex flex-col items-center gap-1.5 z-10">
                      <div
                        className={`flex items-center justify-center text-xs font-black transition-all ${
                          hasGif
                            ? 'size-9 bg-transparent overflow-visible relative'
                            : `size-9 rounded-full overflow-hidden ${
                                isCancelledState
                                  ? 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                                  : isCurrent
                                  ? statusInfo.activeCircleBg
                                  : isCompleted
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                              }`
                        }`}
                      >
                        {st.s === 1 ? (
                          <img
                            src="/images/past.gif"
                            alt="Past Status"
                            className="w-9.5 h-9.5 max-w-none object-contain pointer-events-none"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/past.gif';
                            }}
                          />
                        ) : st.s === 2 ? (
                          <img
                            src="/images/cooking.gif"
                            alt="Kitchen Cooking"
                            className="w-9.5 h-9.5 max-w-none object-contain pointer-events-none"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/cooking.gif';
                            }}
                          />
                        ) : st.s === 3 ? (
                          <img
                            src="/images/delivery-scooter.gif"
                            alt="Rider Scooter"
                            className="w-9.5 h-9.5 max-w-none object-contain pointer-events-none"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/scooter.gif';
                            }}
                          />
                        ) : (
                          <img
                            src="/images/verified.gif"
                            alt="Delivered Verified"
                            className="w-9.5 h-9.5 max-w-none object-contain pointer-events-none"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/verified.gif';
                            }}
                          />
                        )}
                      </div>
                      <span
                        className={`text-[11px] transition-colors ${isCancelledState
                            ? 'font-medium text-neutral-400'
                            : isCurrent
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

            {/* Cancelled Order Notice Banner */}
            {statusInfo.step === 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 font-medium flex items-center gap-2">
                <Ban className="size-4 text-rose-600 shrink-0" />
                <span>This order was cancelled and will not be prepared or delivered.</span>
              </div>
            )}

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

            {/* Modal Footer Actions */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (statusInfo.step === 0 || statusInfo.step === 4) {
                    dismissOrder(activeOrder.id);
                  } else {
                    handleMinimize();
                  }
                }}
                className="w-full py-3 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition text-center shadow-xs cursor-pointer"
              >
                {statusInfo.step === 0 ? 'Dismiss Cancelled Order' : statusInfo.step === 4 ? 'Close Tracker' : 'Minimize Tracker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Popup Modal */}
      {showCancelConfirmModal && activeOrder && (
        <div
          onClick={() => setShowCancelConfirmModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in text-center cursor-default relative"
          >
            <button
              type="button"
              onClick={() => setShowCancelConfirmModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="size-6 text-rose-600" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-neutral-900 tracking-tight">
                Cancel order #{activeOrder.id}?
              </h3>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                Are you sure you want to cancel this order? Kitchen preparation will stop immediately.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-medium text-xs transition cursor-pointer"
              >
                keep order
              </button>

              <button
                type="button"
                onClick={async () => {
                  setShowCancelConfirmModal(false);
                  await handleCancelOrder();
                }}
                disabled={isCancelling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer disabled:opacity-60"
              >
                {isCancelling ? 'cancelling…' : 'cancel order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
