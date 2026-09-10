import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useOrderStore, OrderStatus } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { isApiConfigured } from '../lib/api';
import { X, ChevronUp, MapPin, Truck, Utensils, CheckCircle2, Clock, AlertCircle, Ban, MoreVertical, AlertTriangle, Calendar, Layers } from 'lucide-react';
import { formatCurrency } from '../lib/nutritionParser';
import { toast } from 'sonner';

/**
 * How long the "Delivered" or "Cancelled" banner stays up before hiding itself automatically.
 */
const DELIVERED_AUTO_HIDE_MS = 4_000;

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
    /* private browsing */
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
  const [selectedOrderIndex, setSelectedOrderIndex] = useState<number | 'all'>(0);
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
  const [activeDropdownOrderId, setActiveDropdownOrderId] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null);

  // Keep dismissed IDs and skips in sync with localStorage and real-time events
  const [skipsVersion, setSkipsVersion] = useState(0);
  useEffect(() => {
    const handleSync = () => {
      setDismissedIds(new Set(Object.keys(readJson(DISMISSED_KEY))));
      setSkipsVersion((v) => v + 1);
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('bkl-orders-updated', handleSync);
    window.addEventListener('bkl-skips-updated', handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'skips_updated' || ev.data?.type === 'order_status_updated') {
            setSkipsVersion((v) => v + 1);
          }
        };
      }
    } catch {}

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('bkl-orders-updated', handleSync);
      window.removeEventListener('bkl-skips-updated', handleSync);
    };
  }, []);

  // Read current route location from TanStack Router
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  // Multi-delivery detection: finds active standard web orders + active subscriptions
  const activeOrdersList = useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    const todayDayNum = new Date().getDate();

    let localSkips: string[] = [];
    try {
      const saved = localStorage.getItem('bkl_skipped_dates');
      if (saved) localSkips = JSON.parse(saved);
    } catch {}

    const isExpired = (o: any) => {
      if (!o) return true;
      if (dismissedIds.has(o.id) || (o.serverId && dismissedIds.has(o.serverId))) return true;
      if (isCancelled(o.status)) return true;
      if (!isDone(o.status)) return false;

      const seen = readJson(FIRST_SEEN_KEY);
      const firstSeen = seen[o.id] || (o.serverId ? seen[o.serverId] : undefined);
      if (firstSeen) {
        return Date.now() - firstSeen > DELIVERED_AUTO_HIDE_MS;
      }
      return false;
    };

    const isTodayOrRecentOrder = (o: any) => {
      if (!o.createdAt && !o.placed_at && !o.created_at) return true;
      const orderDateStr = o.createdAt || o.placed_at || o.created_at;
      try {
        const d = new Date(orderDateStr);
        if (isNaN(d.getTime())) return true;
        return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
      } catch {
        return true;
      }
    };

    const isCookingOrDelivering = (st: any) => {
      const s = String(st || '').toLowerCase().trim();
      return s === 'in_kitchen' || s === 'in kitchen' || s === 'preparing' || s === 'packed' || s === 'out_for_delivery' || s === 'out for delivery' || s === 'delivered';
    };

    const isSubscriptionOrder = (o: any) =>
      o?.channel === 'subscription' ||
      String(o?.id || '').startsWith('BKL-SUB-') ||
      (o?.itemsSummary && (o.itemsSummary.toLowerCase().includes('subscription') || o.itemsSummary.toLowerCase().includes('plan'))) ||
      (o?.itemsList && o.itemsList.some((item: any) => item.title?.toLowerCase().includes('subscription') || item.title?.toLowerCase().includes('plan')));

    // Helper to evaluate if order qualifies as active delivery for today
    const qualifies = (o: any) => {
      if (!o || isCancelled(o.status) || isExpired(o)) return false;
      const isSub = isSubscriptionOrder(o);

      if (isSub) {
        // 1. Must NOT be skipped today
        const isSkippedToday = localSkips.includes(todayIso);
        if (isSkippedToday) return false;

        // 2. Show if placed today/recent OR when kitchen is actively preparing/delivering today's meal
        if (!isTodayOrRecentOrder(o) && !isCookingOrDelivering(o.status)) return false;

        return true;
      } else {
        // Standard Web Store Order: must be recent/today's order and not done/cancelled
        if (!isTodayOrRecentOrder(o)) return false;
        return !isCancelled(o.status);
      }
    };

    const finalDeliveries: any[] = [];
    const allCandidates = latestPlacedOrder ? [latestPlacedOrder, ...orders] : [...orders];
    const seenIds = new Set<string>();

    for (const o of allCandidates) {
      if (!qualifies(o)) continue;
      const idKey = o.id ? String(o.id).trim().toLowerCase() : '';
      const serverKey = o.serverId ? String(o.serverId).trim().toLowerCase() : '';

      // Strict deduplication by ID or server ID
      if ((idKey && seenIds.has(idKey)) || (serverKey && seenIds.has(serverKey))) {
        continue;
      }
      if (idKey) seenIds.add(idKey);
      if (serverKey) seenIds.add(serverKey);

      finalDeliveries.push(o);
    }

    return finalDeliveries;
  }, [orders, latestPlacedOrder, dismissedIds, skipsVersion]);

  const safeIndex = typeof selectedOrderIndex === 'number'
    ? (selectedOrderIndex < activeOrdersList.length ? selectedOrderIndex : 0)
    : 'all';

  const activeOrder = typeof safeIndex === 'number'
    ? (activeOrdersList[safeIndex] || activeOrdersList[0] || null)
    : (activeOrdersList[0] || null);

  // Auto-expand when a new order is placed
  useEffect(() => {
    if (latestPlacedOrder?.id && latestPlacedOrder.isNew) {
      if (!expandedOrdersRef.current.has(latestPlacedOrder.id) && !userMinimizedRef.current.has(latestPlacedOrder.id)) {
        expandedOrdersRef.current.add(latestPlacedOrder.id);
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

  // HIDE IF NO ACTIVE ORDERS, or on admin / kitchen pages
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/ops-console') ||
    pathname.startsWith('/kitchen') ||
    !activeOrder ||
    activeOrdersList.length === 0
  ) {
    return null;
  }

  const isSubscriptionOrder = (o: any) =>
    o?.channel === 'subscription' ||
    String(o?.id || '').startsWith('BKL-SUB-') ||
    (o?.itemsSummary && (o.itemsSummary.toLowerCase().includes('subscription') || o.itemsSummary.toLowerCase().includes('plan'))) ||
    (o?.itemsList && o.itemsList.some((item: any) => item.title?.toLowerCase().includes('subscription') || item.title?.toLowerCase().includes('plan')));

  const handleMinimize = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeOrder?.id) {
      userMinimizedRef.current.add(activeOrder.id);
    }
    setActiveDropdownOrderId(null);
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

  // Check if today is skipped for a subscription order
  const isSubSkipped = (ord: any) => {
    if (!isSubscriptionOrder(ord)) return false;
    const todayIso = new Date().toISOString().split('T')[0];
    let localSkips: string[] = [];
    try {
      const saved = localStorage.getItem('bkl_skipped_dates');
      if (saved) localSkips = JSON.parse(saved);
    } catch {}

    return localSkips.includes(todayIso);
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel || isCancelling) return;
    const targetId = orderToCancel.id;
    setIsCancelling(true);
    const res = await useOrderStore.getState().cancelUserOrder(targetId, 'Cancelled by customer via tracker');
    setIsCancelling(false);
    if (res.ok) {
      toast.success(`Order #${targetId} cancelled successfully`);
      dismissOrder(targetId);
      setOrderToCancel(null);
    } else {
      toast.error(res.error || 'Could not cancel order');
    }
  };

  const handleForceCancelOrder = async (targetOrder: any) => {
    if (!targetOrder || isCancelling) return;
    const targetId = targetOrder.id;
    setIsCancelling(true);
    const res = await useOrderStore.getState().forceCancelUserOrder(targetId, 'Force cancelled by customer via CANCEL ORDER button');
    setIsCancelling(false);
    if (res.ok) {
      toast.success(`Order #${targetId} CANCELLED`);
      dismissOrder(targetId);
      setOrderToCancel(null);
    } else {
      toast.error(res.error || 'Could not cancel order');
    }
  };

  const hasMultipleDeliveries = activeOrdersList.length > 1;

  // Render an individual order card (reused for single tab view & stacked view)
  const renderOrderCard = (ord: any, isCardStacked = false) => {
    const isSub = isSubscriptionOrder(ord);
    const ordStatusInfo = getStatusDetails(ord.status);
    const isCancellable = !isDone(ord.status);
    const isDropdownOpen = activeDropdownOrderId === ord.id;
    const isSkipped = isSubSkipped(ord);

    return (
      <div
        key={ord.id}
        className={`bg-white rounded-2xl border space-y-3.5 ${
          isCardStacked
            ? 'p-4 border-neutral-200/90 shadow-sm'
            : 'p-0 border-none'
        }`}
      >
        {/* Order Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-black text-neutral-900">{ord.id}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ordStatusInfo.badgeColor}`}>
                {ord.status}
              </span>
              {isSub ? (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-200">
                  VIP Subscription
                </span>
              ) : (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-200">
                  Web Order
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 font-medium">{ordStatusInfo.desc}</p>
          </div>

          <div className="flex items-center gap-1.5 relative">
            {/* 3-Dot Options Dropdown Button */}
            {!isDone(ord.status) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdownOrderId((prev) => (prev === ord.id ? null : ord.id));
                  }}
                  className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition cursor-pointer flex items-center justify-center border border-neutral-200 bg-neutral-50"
                  title="Order options menu"
                >
                  <MoreVertical className="size-4" />
                </button>

                {/* Dropdown Menu Popup */}
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-neutral-200 rounded-2xl shadow-xl z-30 py-1 overflow-hidden animate-scale-in">
                    {isCancellable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownOrderId(null);
                          setOrderToCancel(ord);
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
                        setActiveDropdownOrderId(null);
                        await handleForceCancelOrder(ord);
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

            {!isCardStacked && (
              <button
                onClick={handleMinimize}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
                title="Close Tracker Popup"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Skipped Notice Banner for Subscriptions */}
        {isSkipped && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 font-bold flex items-center gap-2">
            <span>⏸️</span>
            <span>Today's Subscription Meal is Skipped • Kitchen prep is paused for today.</span>
          </div>
        )}

        {/* Step Progress Line with Animated GIFs */}
        <div className="py-2.5 px-1">
          <div className="flex items-center justify-between relative px-2">
            {/* Background Connecting Line */}
            <div className="absolute left-6 right-6 top-4.5 h-0.5 bg-neutral-200 -z-0 rounded-full overflow-hidden">
              <div
                className={`h-full ${ordStatusInfo.lineColor} transition-all duration-500`}
                style={{
                  width:
                    ordStatusInfo.step === 0
                      ? '0%'
                      : ordStatusInfo.step === 4
                        ? '100%'
                        : `${((ordStatusInfo.step - 1) / 3) * 100}%`,
                }}
              />
            </div>

            {[
              { s: 1, label: 'Placed', icon: Clock },
              { s: 2, label: 'Kitchen', icon: Utensils },
              { s: 3, label: 'Rider', icon: Truck },
              { s: 4, label: 'Delivered', icon: CheckCircle2 },
            ].map((st) => {
              const isCompleted = ordStatusInfo.step > st.s || ordStatusInfo.step === 4;
              const isCurrent = ordStatusInfo.step === st.s && ordStatusInfo.step !== 4;
              const isCancelledState = ordStatusInfo.step === 0;

              return (
                <div key={st.s} className="flex flex-col items-center gap-1.5 z-10">
                  <div className="flex items-center justify-center text-xs font-black size-9 bg-transparent overflow-visible relative">
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
                    className={`text-[11px] transition-colors ${
                      isCancelledState
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
        {ordStatusInfo.step === 0 && (
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
              {ord.itemsSummary || 'Healthy Meals'}
            </span>
          </div>
          <div className="flex justify-between text-neutral-600 font-medium">
            <span>Total Amount:</span>
            <span className="font-bold text-brand-700">{formatCurrency(ord.totalAmount)}</span>
          </div>
          <div className="flex items-start gap-1.5 text-neutral-600 pt-1.5 border-t border-neutral-200/60">
            <MapPin className="size-3.5 text-brand-600 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{ord.customerAddress || 'Express Doorstep Delivery'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Status Button (Fixed at Bottom Right) */}
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end pointer-events-none">
        {pillJustWiggled && (
          <div className="animate-fade-in bg-neutral-900 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 mb-2 border border-emerald-500/40 pointer-events-auto">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span>🎯 Live delivery tracker · Tap anytime!</span>
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
              : hasMultipleDeliveries
                ? 'border-emerald-600 ring-2 ring-emerald-200/70 hover:scale-[1.03]'
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
                (e.currentTarget as HTMLImageElement).src = '/scooter.gif';
              }}
            />
          </div>

          {/* Order ID & Status Label */}
          <div className="text-left leading-tight">
            {hasMultipleDeliveries ? (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.2 rounded-full bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider">
                    {activeOrdersList.length} Deliveries Active
                  </span>
                </div>
                <div className="text-xs font-black text-neutral-900 group-hover:text-emerald-600 transition flex items-center gap-1 mt-0.5">
                  <span>
                    {activeOrdersList.some(isSubscriptionOrder) && activeOrdersList.some(o => !isSubscriptionOrder(o))
                      ? '🛒 Web & 🍱 VIP Plan'
                      : `${activeOrdersList.length} Active Orders`}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-neutral-500">{activeOrder.id}</span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isSubscriptionOrder(activeOrder) ? 'text-purple-700' : 'text-emerald-600'
                  }`}>
                    {isSubscriptionOrder(activeOrder) ? 'VIP Plan' : 'Web Order'}
                  </span>
                </div>
                <div className="text-xs font-black text-neutral-900 group-hover:text-emerald-600 transition">
                  {statusInfo.label}
                </div>
              </div>
            )}
          </div>

          <ChevronUp className={`size-4 text-neutral-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded Order Tracking Modal / Sheet with Jelly Whoosh Transition */}
      {(isExpanded || isMinimizing) && (
        <div
          onClick={handleMinimize}
          className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300 cursor-pointer ${
            isMinimizing ? 'opacity-0' : 'opacity-100 animate-fade-in'
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg bg-white border border-neutral-200 rounded-3xl p-5 shadow-2xl space-y-4 cursor-default max-h-[90vh] overflow-y-auto ${
              isMinimizing ? 'animate-jelly-minimize' : 'animate-jelly-expand'
            }`}
          >
            {/* Multi-Order Tabs Selector (Spacious, Wrap & Scroll Friendly) */}
            {hasMultipleDeliveries && (
              <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-neutral-600 px-1">
                  <span>Active Deliveries ({activeOrdersList.length})</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Switch Tab or Stack</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {activeOrdersList.map((ord, idx) => {
                    const isSub = isSubscriptionOrder(ord);
                    const isSelected = safeIndex === idx;

                    return (
                      <button
                        key={ord.id || idx}
                        type="button"
                        onClick={() => setSelectedOrderIndex(idx)}
                        className={`shrink-0 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
                          isSelected
                            ? isSub
                              ? 'bg-purple-700 text-white ring-2 ring-purple-300 shadow-sm'
                              : 'bg-emerald-700 text-white ring-2 ring-emerald-300 shadow-sm'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200'
                        }`}
                      >
                        <span>{isSub ? '🍱 VIP Plan' : `🛒 ${ord.id}`}</span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600 border border-neutral-200/60'
                        }`}>
                          {ord.status}
                        </span>
                      </button>
                    );
                  })}

                  {/* Stack All (Under & Under) View Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIndex('all')}
                    className={`shrink-0 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
                      safeIndex === 'all'
                        ? 'bg-neutral-900 text-white ring-2 ring-neutral-400 shadow-sm'
                        : 'bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200'
                    }`}
                  >
                    <Layers className="size-3.5" />
                    <span>View All ({activeOrdersList.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Main Content: Single Order Tab View OR Stacked View */}
            {safeIndex === 'all' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-500 pb-1 border-b border-neutral-100">
                  <span>Showing all {activeOrdersList.length} deliveries stacked</span>
                  <button
                    onClick={handleMinimize}
                    className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {activeOrdersList.map((ord) => renderOrderCard(ord, true))}
              </div>
            ) : (
              renderOrderCard(activeOrder, false)
            )}

            {/* Modal Footer Actions */}
            <div className="pt-2 border-t border-neutral-100">
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
      {orderToCancel && (
        <div
          onClick={() => setOrderToCancel(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in text-center cursor-default relative"
          >
            <button
              type="button"
              onClick={() => setOrderToCancel(null)}
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
                Cancel order #{orderToCancel.id}?
              </h3>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                Are you sure you want to cancel this order? Kitchen preparation will stop immediately.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-medium text-xs transition cursor-pointer"
              >
                keep order
              </button>

              <button
                type="button"
                onClick={async () => {
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
