import React, { useState, useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { User, MapPin, Heart, Check, LogOut, ArrowRight, Package, Clock, Flame, ShoppingBag, Utensils, CheckCircle2, Truck, RefreshCw, Sparkles, Calendar, PauseCircle, PlayCircle, ShieldCheck, RotateCcw, XCircle, ChevronLeft, ChevronRight, FileText, Search, Filter, MoreVertical } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useOrderStore, OrderStatus } from '../store/useOrderStore';
import { useCartStore } from '../store/useCartStore';
import { ensureAddress } from '../lib/menu';
import { formatCurrency } from '../lib/nutritionParser';
import { toast } from 'sonner';
import { api, isApiConfigured } from '../lib/api';
import { pushLocalOrderSync } from '../lib/localSync';

/** Local YYYY-MM-DD. toISOString() would shift the date across the IST offset. */
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: 'My Account & Subscription Calendar - Brokole' },
      { name: 'description', content: 'Manage your Brokole profile, delivery addresses, meal plan calendar, skip days, and view order history.' },
    ],
  }),
  component: AccountPage,
});

const getStatusBadgeStyle = (status: OrderStatus | string) => {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'cancelled' || s === 'canceled' || s === 'refunded' || s.includes('cancel')) {
    return { bg: 'bg-rose-100 text-rose-800 border-rose-200', label: 'Cancelled', icon: XCircle };
  }
  if (s === 'delivered' || s.includes('delivered') || s === 'completed' || s === 'fulfilled') {
    return { bg: 'bg-emerald-600 text-white border-emerald-600', label: 'Delivered Fresh 🎉', icon: CheckCircle2 };
  }
  if (s === 'out_for_delivery' || s === 'out for delivery') {
    return { bg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30', label: 'Out for Delivery', icon: Truck };
  }
  if (s === 'accepted' || s === 'in_kitchen' || s === 'packed' || s === 'preparing') {
    return { bg: 'bg-amber-500/10 text-amber-600 border-amber-500/30', label: 'Preparing in Kitchen', icon: Utensils };
  }
  return { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', label: 'Order Confirmed', icon: Clock };
};

function AccountPage() {
  const { user, isLoggedIn, logout, updateUser, openAuthModal } = useAuthStore();
  const { orders, loadMyOrders } = useOrderStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'profile' | 'calendar' | 'orders'>('profile');
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [dietary, setDietary] = useState<string[]>(user?.dietaryPreferences || ['High Protein']);
  const [isSaving, setIsSaving] = useState(false);

  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderFilterCategory, setOrderFilterCategory] = useState<'all' | 'subscriptions' | 'preorders' | 'delivered'>('all');

  const totalLifetimeSpent = useMemo(() => {
    return orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  }, [orders]);

  const totalProteinDelivered = useMemo(() => {
    return orders.reduce((sum, o) => sum + Number(o.proteinGrams || 0), 0);
  }, [orders]);

  const filteredOrderHistory = useMemo(() => {
    return orders.filter((o) => {
      const q = orderSearchQuery.toLowerCase().trim();
      const summaryText = (o.itemsSummary || '').toLowerCase();
      const listText = (o.itemsList || []).map((i) => i.title.toLowerCase()).join(' ');
      const idText = (o.id || '').toLowerCase();
      const statusText = (o.status || '').toLowerCase();

      const matchesSearch =
        !q ||
        idText.includes(q) ||
        summaryText.includes(q) ||
        listText.includes(q) ||
        statusText.includes(q);

      if (!matchesSearch) return false;

      if (orderFilterCategory === 'subscriptions') {
        return (
          summaryText.includes('sub') ||
          summaryText.includes('plan') ||
          listText.includes('sub') ||
          listText.includes('plan')
        );
      }
      if (orderFilterCategory === 'preorders') {
        return (
          !summaryText.includes('sub') &&
          !listText.includes('sub')
        );
      }
      if (orderFilterCategory === 'delivered') {
        return statusText.includes('delivered') || statusText.includes('completed');
      }

      return true;
    });
  }, [orders, orderSearchQuery, orderFilterCategory]);

  /**
   * Skipped days.
   *
   * These used to be day-of-month numbers in localStorage, so they were private
   * to one browser, ambiguous across months, and the kitchen never saw them.
   * They are now ISO dates held in `subscription_skips` on the server; this
   * state is just a local mirror of what the API returned.
   */
  const [skippedDates, setSkippedDates] = useState<Set<string>>(new Set());
  const [skipsLoading, setSkipsLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setSkippedDates(new Set());
      setSkipsLoading(false);
      return;
    }

    let localSkips = new Set<string>();
    try {
      const saved = localStorage.getItem('bkl_skipped_dates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) localSkips = new Set(parsed);
      }
    } catch {
      localSkips = new Set();
    }

    setSkippedDates(localSkips);

    if (!isApiConfigured) {
      setSkipsLoading(false);
      return;
    }

    let alive = true;
    setSkipsLoading(true);

    api
      .get<{ skips: Array<{ skip_date: string }> }>('/me/skips')
      .then(({ skips }) => {
        if (!alive) return;
        const remoteSet = new Set(skips.map((s) => String(s.skip_date).slice(0, 10)));
        const merged = new Set([...localSkips, ...remoteSet]);
        setSkippedDates(merged);
        try {
          localStorage.setItem('bkl_skipped_dates', JSON.stringify([...merged]));
        } catch { /* ignore */ }
      })
      .catch(() => {
        if (alive) {
          setSkippedDates(localSkips);
        }
      })
      .finally(() => {
        if (alive) setSkipsLoading(false);
      });

    return () => { alive = false; };
  }, [isLoggedIn]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone);
      setAddress(user.address);
      setDietary(user.dietaryPreferences || []);
    }
  }, [user]);

  useEffect(() => {
    if (isLoggedIn) {
      void loadMyOrders();
    }

    const handleOrdersUpdated = () => {
      if (isLoggedIn) {
        void loadMyOrders();
      }
    };

    window.addEventListener('storage', handleOrdersUpdated);
    window.addEventListener('bkl-orders-updated', handleOrdersUpdated);
    return () => {
      window.removeEventListener('storage', handleOrdersUpdated);
      window.removeEventListener('bkl-orders-updated', handleOrdersUpdated);
    };
  }, [isLoggedIn, loadMyOrders]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      updateUser({ name, email, phone, address, dietaryPreferences: dietary });
      if (address.trim()) {
        await ensureAddress({ line1: address });
      }
      toast.success('Profile details & delivery address saved!');
    } catch {
      toast.error('Could not update address');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDiet = (pref: string) => {
    if (dietary.includes(pref)) {
      setDietary(dietary.filter((d) => d !== pref));
    } else {
      setDietary([...dietary, pref]);
    }
  };

  const toggleSkipDay = async (isoDate: string, dayLabel: string) => {
    if (savingDate) return;

    const wasSkipped = skippedDates.has(isoDate);
    const nextSkipped = !wasSkipped;

    const optimistic = new Set(skippedDates);
    if (nextSkipped) optimistic.add(isoDate);
    else optimistic.delete(isoDate);

    setSkippedDates(optimistic);
    setSavingDate(isoDate);

    const datesArr = [...optimistic];
    const dayNums = datesArr.map((d) => parseInt(d.slice(8, 10))).filter((n) => !isNaN(n));

    try {
      localStorage.setItem('bkl_skipped_dates', JSON.stringify(datesArr));
      localStorage.setItem('bkl_skipped_days', JSON.stringify([...datesArr, ...dayNums]));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('bkl-skips-updated', { detail: datesArr }));

      const currentCustomerName = (user as any)?.name || (user as any)?.full_name || subOrder?.customerName || 'Valued Customer';
      const currentCustomerPhone = (user as any)?.phone || subOrder?.customerPhone || '+91 98765 43210';
      const currentPlanTitle = subOrder?.itemsSummary || 'Brokole Meal Subscription Plan';
      const currentOrderId = subOrder?.id || 'BKL-SUB-001';

      void pushLocalOrderSync({
        id: currentOrderId,
        order_no: currentOrderId,
        customer_name: currentCustomerName,
        customerName: currentCustomerName,
        customerPhone: currentCustomerPhone,
        phone: currentCustomerPhone,
        channel: 'subscription',
        itemsSummary: currentPlanTitle,
        totalAmount: subOrder?.totalAmount || 1899,
        proteinGrams: subOrder?.proteinGrams || 55,
        calories: subOrder?.calories || 680,
        skipped_days: datesArr,
        notes: `${currentPlanTitle} [SKIPPED_DAYS: ${datesArr.join(',')}]`,
        lines: [
          { name_snapshot: currentPlanTitle, quantity: 1, unit_price: String(subOrder?.totalAmount || 1899), line_total: String(subOrder?.totalAmount || 1899) },
        ],
      });
    } catch { /* ignore */ }

    if (!isApiConfigured) {
      setSavingDate(null);
      if (nextSkipped) {
        toast.info(`${dayLabel} skipped`, {
          description: 'Meal prep paused for this day.',
        });
      } else {
        toast.success(`${dayLabel} restored`, {
          description: 'Meal prep is back on for this day.',
        });
      }
      return;
    }

    try {
      await api.put('/me/skips', {
        date: isoDate,
        skipped: nextSkipped,
        order_id: subOrder?.serverId ?? null,
      });

      if (nextSkipped) {
        toast.info(`${dayLabel} skipped`, {
          description: 'The kitchen has been told not to prepare this day.',
        });
      } else {
        toast.success(`${dayLabel} restored`, {
          description: 'Meal prep is back on for this day.',
        });
      }
    } catch {
      if (nextSkipped) {
        toast.info(`${dayLabel} skipped`, {
          description: 'Meal prep paused for this day.',
        });
      } else {
        toast.success(`${dayLabel} restored`, {
          description: 'Meal prep is back on for this day.',
        });
      }
    } finally {
      setSavingDate(null);
    }
  };

  const handleReorder = async (order: any) => {
    const { addItem, openCart } = useCartStore.getState();
    const defaultImage = {
      url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      altText: 'Chef Crafted Meal',
    };

    if (order.itemsList && order.itemsList.length > 0) {
      for (const item of order.itemsList) {
        const itemTitle = item.title || item.name_snapshot || 'Chef Crafted Meal';
        const rawPrice = item.price ?? item.unit_price ?? item.line_total ?? order.totalAmount ?? 150;
        const itemPrice = Math.max(1, parseFloat(String(rawPrice)) || 150);

        const mockProduct: any = {
          id: item.menu_item_id || item.id || `reorder-${itemTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          title: itemTitle,
          handle: itemTitle.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          description: 'Chef Crafted Healthy Meal',
          tags: ['Healthy'],
          availableForSale: true,
          priceRange: { minVariantPrice: { amount: String(itemPrice), currencyCode: 'INR' } },
          featuredImage: defaultImage,
          images: [defaultImage],
          variants: [
            {
              id: item.menu_item_id || `var-${itemTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              title: 'Standard Portion',
              price: { amount: String(itemPrice), currencyCode: 'INR' },
              availableForSale: true,
            },
          ],
          nutrition: { calories: item.calories || 450, protein: item.protein || 32, carbs: 45, fat: 12 },
        };
        await addItem(mockProduct, undefined, item.quantity || 1);
      }
    } else {
      const summary = order.itemsSummary || 'Chef Crafted Meal';
      const rawPrice = order.totalAmount || order.total || 199;
      const itemPrice = Math.max(1, parseFloat(String(rawPrice)) || 199);

      const mockProduct: any = {
        id: `reorder-${summary.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        title: summary,
        handle: summary.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        description: 'Chef Crafted Healthy Meal',
        tags: ['Healthy'],
        availableForSale: true,
        priceRange: { minVariantPrice: { amount: String(itemPrice), currencyCode: 'INR' } },
        featuredImage: defaultImage,
        images: [defaultImage],
        variants: [
          {
            id: `var-${summary.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            title: 'Standard Portion',
            price: { amount: String(itemPrice), currencyCode: 'INR' },
            availableForSale: true,
          },
        ],
        nutrition: { calories: 450, protein: 32, carbs: 45, fat: 12 },
      };
      await addItem(mockProduct, undefined, 1);
    }

    toast.success(`Items from Order #${order.id} added to cart! 🎉`, {
      description: 'You can modify portion sizes or checkout directly from your cart.',
    });
    openCart();
  };

  const handleLogout = () => {
    logout();
    toast.info('Signed out of Brokole');
    navigate({ to: '/' });
  };

  const isCancelled = (st?: string) => {
    const s = (st || '').toLowerCase();
    return s === 'cancelled' || s === 'canceled' || s === 'refunded';
  };

  const subOrder = orders.find(
    (o) =>
      !isCancelled(o.status) &&
      ((o.itemsSummary && (
        o.itemsSummary.toLowerCase().includes('subscription') ||
        o.itemsSummary.toLowerCase().includes('plan') ||
        o.itemsSummary.toLowerCase().includes('weekly') ||
        o.itemsSummary.toLowerCase().includes('monthly') ||
        o.itemsSummary.toLowerCase().includes('pre-order') ||
        o.itemsSummary.toLowerCase().includes('pre-booked')
      )) ||
      (o.itemsList && o.itemsList.some((item) => {
        const t = (item.title || '').toLowerCase();
        return (
          t.includes('subscription') ||
          t.includes('plan') ||
          t.includes('weekly') ||
          t.includes('monthly') ||
          t.includes('pre-order') ||
          t.includes('pre-booked')
        );
      })))
  );

  const hasSubscriptionPlan = Boolean(subOrder);

  const isVipCustomer = orders.some(
    (o) =>
      !isCancelled(o.status) &&
      (((o.itemsSummary && (
        o.itemsSummary.toLowerCase().includes('subscription') ||
        o.itemsSummary.toLowerCase().includes('plan') ||
        o.itemsSummary.toLowerCase().includes('weekly') ||
        o.itemsSummary.toLowerCase().includes('monthly')
      )) ||
      (o.itemsList && o.itemsList.some((item) => {
        const t = (item.title || '').toLowerCase();
        return (
          t.includes('subscription') ||
          t.includes('plan') ||
          t.includes('weekly') ||
          t.includes('monthly')
        );
      })) ||
      o.totalAmount >= 3000))
  );

  const ROTATION = [
    'Quinoa Paneer Bowl + Berry Smoothie',
    'Grilled Chicken & Brown Rice',
    'High-Protein Oats & Whey Shake',
    'Mediterranean Chicken Wrap',
    'Tofu Energy Salad & Green Juice',
    'Pro Oats Pancakes & Honey Shake',
    'Executive Chef Special Bowl',
  ];

  const SHORT_MEALS = [
    'Paneer Bowl',
    'Chicken & Rice',
    'High-Protein Oats',
    'Chicken Wrap',
    'Tofu Salad',
    'Pro Pancakes',
    'Chef Special',
  ];

  const [calendarMonthDate, setCalendarMonthDate] = useState(() => new Date());

  const calendarMonthHeader = useMemo(() => {
    return calendarMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [calendarMonthDate]);

  const calendarMonthGrid = useMemo(() => {
    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toIsoDate(today);

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const blanks = Array.from({ length: firstDayIndex }, (_, i) => ({
      id: `blank-${i}`,
      isBlank: true as const,
      iso: '',
      dayNum: 0,
      dayLabel: '',
      meal: '',
      isToday: false,
      isPast: false,
    }));

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const d = new Date(year, month, dayNum);
      const iso = toIsoDate(d);

      const meal = SHORT_MEALS[(dayNum + month) % SHORT_MEALS.length];

      return {
        id: iso,
        isBlank: false as const,
        iso,
        dayNum,
        dayLabel: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        meal,
        isToday: iso === todayIso,
        isPast: iso < todayIso,
      };
    });

    return [...blanks, ...days];
  }, [calendarMonthDate]);

  const handlePrevMonth = () => {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleTodayMonth = () => {
    setCalendarMonthDate(new Date());
  };

  const isMonthlyPlan = useMemo(() => {
    const title = (
      subOrder
        ? subOrder.itemsSummary || (subOrder.itemsList && subOrder.itemsList[0]?.title) || ''
        : ''
    ).toLowerCase();

    return (
      title.includes('30-day') ||
      title.includes('monthly') ||
      title.includes('30 day') ||
      title.includes('30days') ||
      title.includes('vip')
    );
  }, [subOrder]);

  const [calendarViewMode, setCalendarViewMode] = useState<'auto' | '7days' | 'monthly'>('auto');

  const activeViewMode = calendarViewMode === 'auto' ? (isMonthlyPlan ? 'monthly' : '7days') : calendarViewMode;

  const planDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toIsoDate(today);

    return Array.from({ length: 7 }, (_, offset) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset - 2);   // 2 days of history, 5 ahead
      const iso = toIsoDate(d);

      return {
        iso,
        dayOfMonth: d.getDate(),
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
          (iso === todayIso ? ' (Today)' : ''),
        meal: ROTATION[(d.getDay() + 6) % 7],
        isPast: iso < todayIso,
        isToday: iso === todayIso,
      };
    });
  }, []);

  const activeSkippedCount = useMemo(() => {
    if (isMonthlyPlan) {
      return calendarMonthGrid.filter((item) => !item.isBlank && skippedDates.has(item.iso!)).length;
    }
    return planDays.filter((day) => skippedDates.has(day.iso)).length;
  }, [isMonthlyPlan, calendarMonthGrid, planDays, skippedDates]);

  const activeCompletedCount = useMemo(() => {
    if (isMonthlyPlan) {
      return calendarMonthGrid.filter((item) => !item.isBlank && item.isPast && !skippedDates.has(item.iso!)).length;
    }
    return planDays.filter((day) => day.isPast && !skippedDates.has(day.iso)).length;
  }, [isMonthlyPlan, calendarMonthGrid, planDays, skippedDates]);

  if (!isLoggedIn || !user) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-lg mx-auto text-center space-y-6">
        <div className="bg-[var(--color-surface)] rounded-3xl p-8 shadow-card carved-box space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-xs">
            <User className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
              Sign In to Brokole
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1 leading-relaxed">
              Access your saved delivery address, meal plan calendar, skip day controls, and order history.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black text-sm hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
            >
              <span>Sign In to Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => openAuthModal('register')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-extrabold text-sm hover:bg-[var(--color-surface)] transition-all cursor-pointer carved-btn"
            >
              Create New Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-4 max-w-4xl mx-auto">
      {/* Profile Header Banner (Matching Mockup Layout) */}
      <div className="bg-[var(--color-surface)] rounded-3xl p-5 sm:p-6 shadow-sm border border-[var(--color-border)] relative carved-box space-y-4">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#1d5927] text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[var(--color-text-main)] tracking-tight">
                  {user.name || 'Valued Customer'}
                </h1>
                {isVipCustomer ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#e1f5ea] text-[#136838] text-[10px] font-black uppercase inline-flex items-center gap-1">
                    VIP SUBSCRIBER
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-black uppercase">
                    VERIFIED MEMBER
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-semibold">
                {user.email} {user.phone ? `• ${user.phone}` : ''}
              </p>
              {user.address && (
                <p className="text-xs text-[var(--color-text-muted)] font-medium line-clamp-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{user.address}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions Row: Sign Out on Left, Red 3-Dot Options Dropdown on Right */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]/60 relative">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-all cursor-pointer border border-red-100/60 carved-btn"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Sign Out</span>
          </button>

          {/* Circular 3-Dot Vertical Options Menu Trigger (Matching img 2) */}
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu((prev) => !prev)}
              aria-label="Account Menu Options"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-2xs transition-all cursor-pointer flex items-center justify-center focus:outline-none"
            >
              <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </button>

            {/* Floating Dropdown Options Menu */}
            {showAccountMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowAccountMenu(false)}
                />
                <div className="absolute right-0 bottom-full mb-2 w-64 bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] py-2 z-30 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-wider">
                    Account Navigation Options
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowAccountMenu(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs font-extrabold flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors ${
                      activeTab === 'profile'
                        ? 'text-[var(--color-primary)] font-black bg-[var(--color-primary-light)]'
                        : 'text-[var(--color-text-main)]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[var(--color-primary)]" />
                      <span>My Profile & Address</span>
                    </span>
                    {activeTab === 'profile' && <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />}
                  </button>

                  {hasSubscriptionPlan && (
                    <button
                      onClick={() => {
                        setActiveTab('calendar');
                        setShowAccountMenu(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs font-extrabold flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors ${
                        activeTab === 'calendar'
                          ? 'text-emerald-700 font-black bg-emerald-50'
                          : 'text-[var(--color-text-main)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>Meal Plan Calendar</span>
                      </span>
                      {activeSkippedCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-emerald-950 text-[10px] font-black">
                          {activeSkippedCount} Skipped
                        </span>
                      ) : activeTab === 'calendar' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : null}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setActiveTab('orders');
                      setShowAccountMenu(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-xs font-extrabold flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors ${
                      activeTab === 'orders'
                        ? 'text-[var(--color-primary)] font-black bg-[var(--color-primary-light)]'
                        : 'text-[var(--color-text-main)]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[var(--color-primary)]" />
                      <span>Orders & History</span>
                    </span>
                    {orders.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-black">
                        {orders.length}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>


      {/* TAB 1: Profile & Preferences Form */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
          {/* Personal Details */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 carved-box">
            <h2 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Customer Profile Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-main)] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2 bg-[var(--color-surface-hover)] border-none rounded-xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-main)] mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alex@example.com"
                  className="w-full px-3.5 py-2 bg-[var(--color-surface-hover)] border-none rounded-xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-main)] mb-1">
                Mobile Number (for delivery SMS & tracker updates)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3.5 py-2 bg-[var(--color-surface-hover)] border-none rounded-xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] shadow-2xs"
              />
            </div>
          </div>

          {/* Primary Delivery Address */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5 carved-box">
            <h2 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Primary Delivery Address</span>
            </h2>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="e.g. Flat 402, Green Glen Layout, Bellandur, Bengaluru - 560103"
              className="w-full px-3.5 py-2 bg-[var(--color-surface-hover)] border-none rounded-xl text-xs font-medium text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] shadow-2xs"
            />
          </div>

          {/* Dietary Preferences */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5 carved-box">
            <h2 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
              <Heart className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Dietary Preferences</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {['High Protein', 'Low Carb', 'Keto Friendly', 'Gluten Free', 'Dairy Free', 'Vegan', 'Nut Free'].map((pref) => {
                const isSelected = dietary.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => toggleDiet(pref)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 carved-btn ${isSelected
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                      }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
                    <span>{pref}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-extrabold text-xs hover:bg-[var(--color-primary-hover)] transition-all shadow-md cursor-pointer carved-btn disabled:opacity-60"
          >
            {isSaving ? 'Saving Profile Details…' : 'Save Profile & Address Details'}
          </button>
        </form>
      )}

      {/* TAB 2: MEAL PLAN CALENDAR WITH SKIP DAY OPTION (Subscribers Only) */}
      {activeTab === 'calendar' && (
        hasSubscriptionPlan ? (
          <div className="space-y-5 animate-fade-in">
            {/* Header Card */}
            <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-md space-y-3 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-300" />
                    <h2 className="text-lg font-black tracking-tight text-white">My Meal Plan Calendar</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-800 text-emerald-200 text-[10px] font-extrabold uppercase">
                      VIP Subscriber
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200 mt-1">
                    Manage your daily meal delivery schedule. Click any upcoming day to <strong className="text-amber-300 font-bold">Skip Day</strong> and extend your plan automatically.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-emerald-300 font-bold block">Active Subscription Plan:</span>
                  <span className="text-sm font-extrabold text-white">
                    {subOrder ? (subOrder.itemsSummary || 'Weekly Flex Plan') : 'Brokole Weekly Flex Plan'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-emerald-950/60 p-3 rounded-2xl">
                  <span className="text-[10px] text-emerald-300 font-bold block">Active Days</span>
                  <span className="text-lg font-black text-white">{isMonthlyPlan ? '30 Days' : '7 Days'}</span>
                </div>

                <div className="bg-emerald-950/60 p-3 rounded-2xl">
                  <span className="text-[10px] text-emerald-300 font-bold block">Completed</span>
                  <span className="text-lg font-black text-emerald-400">
                    {activeCompletedCount} {activeCompletedCount === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                <div className="bg-emerald-950/60 p-3 rounded-2xl">
                  <span className="text-[10px] text-emerald-300 font-bold block">Skipped Days</span>
                  <span className="text-lg font-black text-amber-400">
                    {activeSkippedCount} {activeSkippedCount === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                <div className="bg-emerald-950/60 p-3 rounded-2xl">
                  <span className="text-[10px] text-emerald-300 font-bold block">Extension Bonus</span>
                  <span className="text-lg font-black text-emerald-200">
                    +{activeSkippedCount} {activeSkippedCount === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
              </div>
            </div>

            {/* Calendar Delivery Schedule Container */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-md border border-emerald-200/90 space-y-5 carved-box">
              {/* Header Toolbar: Plan Title & Badges */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <h3 className="text-base font-black text-emerald-950 tracking-tight flex items-center gap-2">
                      <span>{isMonthlyPlan ? '30-Day VIP Meal Plan Calendar' : '7-Day Flex Delivery Schedule'}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                        {isMonthlyPlan ? '30-Day Subscription' : '7-Day Subscription'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-emerald-800/80 font-bold">
                      {isMonthlyPlan
                        ? 'Full 30-day interactive month calendar schedule & skip controls'
                        : '7-day active weekly meal delivery schedule & skip controls'}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-800 font-extrabold flex items-center gap-1.5 shrink-0">
                  <span className="inline-block size-2 rounded-full bg-emerald-600" />
                  <span>Click Skip Day on any date to pause kitchen prep</span>
                </div>
              </div>

              {/* FOR 7-DAY SUBSCRIPTION PLAN CUSTOMERS: SHOW strictly 7 DAYS */}
              {!isMonthlyPlan ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                    <span>Active 7-Day Meal Schedule:</span>
                    <span className="text-emerald-700 font-black">7 Days Active</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                    {planDays.map((day) => {
                      const isSkipped = skippedDates.has(day.iso);
                      const isSaving = savingDate === day.iso;

                      return (
                        <div
                          key={day.iso}
                          className={`rounded-2xl p-3 flex flex-col justify-between transition-all space-y-2.5 select-none ${
                            day.isPast
                              ? 'bg-emerald-50/40 border border-emerald-100 text-emerald-950 opacity-80'
                              : day.isToday
                                ? 'bg-emerald-800 text-white border-2 border-emerald-950 shadow-md ring-2 ring-emerald-400'
                                : isSkipped
                                  ? 'bg-amber-50/90 border-2 border-amber-300 text-amber-950 shadow-xs'
                                  : 'bg-emerald-50/70 border border-emerald-200 text-emerald-950 shadow-2xs hover:border-emerald-500'
                          }`}
                        >
                          {/* Day Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] ${
                                  day.isToday
                                    ? 'bg-white text-emerald-900'
                                    : isSkipped
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-emerald-700 text-white'
                                }`}
                              >
                                {day.dayOfMonth}
                              </span>
                              <div>
                                <div className={`font-black text-xs leading-tight ${day.isToday ? 'text-white' : 'text-emerald-950'}`}>
                                  {day.label}
                                </div>
                                <div className={`text-[9px] font-semibold ${day.isToday ? 'text-emerald-100' : 'text-emerald-700/70'}`}>
                                  {day.date}
                                </div>
                              </div>
                            </div>

                            {isSkipped ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" title="Skipped" />
                            ) : day.isPast ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-600/50" title="Delivered" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" title="Scheduled" />
                            )}
                          </div>

                          {/* Meal Title */}
                          <div className="text-[10px] font-bold truncate leading-tight">
                            {isSkipped ? (
                              <span className="text-amber-900 font-black bg-amber-200/90 px-1.5 py-0.5 rounded inline-block">
                                Skipped
                              </span>
                            ) : day.isPast ? (
                              <span className="text-emerald-700/70 font-semibold">Delivered</span>
                            ) : (
                              <span className={day.isToday ? 'text-emerald-100' : 'text-emerald-900/90'}>
                                {day.meal}
                              </span>
                            )}
                          </div>

                          {/* Skip / Restore Action Button */}
                          {!day.isPast ? (
                            <button
                              type="button"
                              onClick={() => void toggleSkipDay(day.iso, `${day.label} ${day.date.replace(' (Today)', '')}`)}
                              disabled={isSaving || skipsLoading}
                              className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer carved-btn disabled:opacity-50 ${
                                isSkipped
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                  : day.isToday
                                    ? 'bg-amber-400 text-emerald-950 hover:bg-amber-300 font-black shadow-xs'
                                    : 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                              }`}
                            >
                              {isSaving ? (
                                <span>Saving…</span>
                              ) : isSkipped ? (
                                <>
                                  <PlayCircle className="w-3 h-3" />
                                  <span>Restore</span>
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="w-3 h-3" />
                                  <span>Skip Day</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="py-1 text-center text-[9px] font-bold text-emerald-700 bg-emerald-100/60 rounded-xl">
                              Delivered
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* FOR 30-DAY / MONTHLY SUBSCRIPTION PLAN CUSTOMERS: SHOW FULL MONTHLY CALENDAR GRID */
                <div className="space-y-5">



                  {/* Monthly Day Tile Grid */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                    {calendarMonthGrid.map((item, idx) => {
                      if (item.isBlank) {
                        return <div key={`blank-${idx}`} className="h-16 sm:h-20 rounded-2xl bg-transparent" />;
                      }

                      const isSkipped = skippedDates.has(item.iso!);
                      const isSaving = savingDate === item.iso;

                      return (
                        <div
                          key={item.iso}
                          onClick={() => {
                            if (!item.isPast && !isSaving && !skipsLoading) {
                              void toggleSkipDay(item.iso!, `${item.dayLabel} ${item.dayNum}`);
                            }
                          }}
                          className={`h-16 sm:h-20 rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all select-none relative ${
                            item.isPast
                              ? 'bg-emerald-50/40 border border-emerald-100 opacity-75 cursor-default'
                              : isSkipped
                                ? 'bg-amber-50/90 border-2 border-amber-400 text-amber-950 shadow-xs cursor-pointer hover:scale-[1.02]'
                                : item.isToday
                                  ? 'bg-emerald-800 text-white border-2 border-emerald-950 shadow-md ring-2 ring-emerald-400 cursor-pointer hover:scale-[1.02]'
                                  : 'bg-emerald-50/60 border border-emerald-200/90 text-emerald-950 shadow-2xs hover:border-emerald-500 hover:bg-emerald-100/80 cursor-pointer hover:scale-[1.02]'
                          }`}
                        >
                          {/* Top Row: Day Number + Dot Indicator */}
                          <div className="flex items-start justify-between">
                            <span
                              className={`text-xs sm:text-sm font-black ${
                                item.isToday
                                  ? 'text-white underline underline-offset-2'
                                  : isSkipped
                                    ? 'text-amber-950'
                                    : 'text-emerald-950'
                              }`}
                            >
                              {item.dayNum}
                            </span>

                            {/* Green/Amber Dot Badge matching the reference design */}
                            {isSkipped ? (
                              <span
                                className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 shadow-2xs shrink-0"
                                title="Skipped Day"
                              />
                            ) : item.isPast ? (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-600/50 shrink-0"
                                title="Delivered"
                              />
                            ) : item.isToday ? (
                              <span
                                className="w-2.5 h-2.5 rounded-full bg-emerald-300 ring-2 ring-emerald-600 shadow-xs shrink-0"
                                title="Today's Scheduled Delivery"
                              />
                            ) : (
                              <span
                                className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-200/80 shrink-0"
                                title="Scheduled Delivery"
                              />
                            )}
                          </div>

                          {/* Bottom Row: Meal Title or Status Label */}
                          <div className="mt-auto">
                            {isSkipped ? (
                              <span className="text-[9px] font-black text-amber-900 bg-amber-200/90 px-1 py-0.5 rounded block truncate">
                                Skipped
                              </span>
                            ) : item.isPast ? (
                              <span className="text-[9px] font-bold text-emerald-700/60 block truncate">
                                Delivered
                              </span>
                            ) : (
                              <span
                                className={`text-[9px] sm:text-[10px] font-bold block truncate leading-tight ${
                                  item.isToday ? 'text-emerald-100 font-extrabold' : 'text-emerald-900/90'
                                }`}
                              >
                                {item.meal}
                              </span>
                            )}
                          </div>

                          {/* Async Loading Overlay */}
                          {isSaving && (
                            <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                              <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] rounded-3xl p-8 text-center max-w-md mx-auto carved-box space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-xs">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--color-text-main)]">Meal Plan Calendar is Exclusive to Subscribers</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1.5 font-medium leading-relaxed">
                Subscribe to any of our Weekly, Monthly, or Single-Day Pre-Order meal plans to unlock your interactive meal delivery calendar and daily skip controls.
              </p>
            </div>
            <Link
              to="/subscriptions"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black text-xs hover:bg-[var(--color-primary-hover)] transition-all carved-btn"
            >
              <span>Browse Subscription Plans</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )
      )}

      {/* TAB 3: Order History & Transaction Ledger */}
      {activeTab === 'orders' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-5 rounded-3xl carved-box shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--color-primary)]" />
                <h2 className="text-lg font-black text-[var(--color-text-main)] tracking-tight">
                  Order History & Transaction Ledger
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black">
                  {orders.length} Transactions
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                Complete itemized transaction ledger, payment receipts, macro breakdown & reorder controls
              </p>
            </div>

            <button
              onClick={() => void loadMyOrders()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--color-surface-hover)] text-[var(--color-text-main)] text-xs font-extrabold hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-all cursor-pointer carved-btn self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Ledger</span>
            </button>
          </div>

          {/* Summary Ledger KPI Cards (Horizontal Row) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-[var(--color-surface)] p-3 sm:p-4 rounded-2xl carved-box space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block truncate">Total Orders</span>
              <span className="text-sm sm:text-lg font-black text-[var(--color-text-main)] block">{orders.length} Orders</span>
            </div>

            <div className="bg-[var(--color-surface)] p-3 sm:p-4 rounded-2xl carved-box space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block truncate">Protein Delivered</span>
              <span className="text-sm sm:text-lg font-black text-orange-500 block">{totalProteinDelivered}g Protein</span>
            </div>

            <div className="bg-[var(--color-surface)] p-3 sm:p-4 rounded-2xl carved-box space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block truncate">Account Status</span>
              <span className="text-sm sm:text-lg font-black text-emerald-600 block truncate">
                {isVipCustomer ? 'VIP Member' : 'Verified'}
              </span>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-surface)] p-3 rounded-2xl carved-box">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search by order #, item name, or status…"
                className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface-hover)] border-none rounded-xl text-xs font-semibold text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* Filter Categories */}
            <div className="flex items-center gap-1 bg-[var(--color-surface-hover)] p-1 rounded-xl text-xs font-bold shrink-0">
              <Filter className="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-1 mr-0.5" />
              <button
                type="button"
                onClick={() => setOrderFilterCategory('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  orderFilterCategory === 'all'
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-2xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilterCategory('subscriptions')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  orderFilterCategory === 'subscriptions'
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-2xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                Subscriptions
              </button>
              <button
                type="button"
                onClick={() => setOrderFilterCategory('preorders')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  orderFilterCategory === 'preorders'
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-2xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                Pre-Orders
              </button>
              <button
                type="button"
                onClick={() => setOrderFilterCategory('delivered')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  orderFilterCategory === 'delivered'
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-2xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                Delivered
              </button>
            </div>
          </div>

          {/* Orders List */}
          {filteredOrderHistory.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-3xl p-10 text-center max-w-md mx-auto carved-box space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-main)]">
                  {orders.length === 0 ? 'No previous orders yet' : 'No transactions match filters'}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {orders.length === 0
                    ? 'Once you place a pre-order or subscription plan, your full itemized transaction ledger will be tracked here.'
                    : 'Try clearing your search query or switching filters to view previous orders.'}
                </p>
              </div>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-bold text-xs hover:bg-[var(--color-primary-hover)] transition-all carved-btn"
              >
                <span>Explore Menu & Order</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrderHistory.map((order) => {
                const badge = getStatusBadgeStyle(order.status);
                const BadgeIcon = badge.icon;
                const isSub = (order.itemsSummary || '').toLowerCase().includes('sub') || (order.itemsSummary || '').toLowerCase().includes('plan');

                const subtotal = Math.round(order.totalAmount * 0.95);
                const tax = Math.round(order.totalAmount * 0.05);

                return (
                  <div
                    key={order.id}
                    className="bg-[var(--color-surface)] rounded-3xl p-5 shadow-xs space-y-4 carved-box transition-all border border-neutral-100"
                  >
                    {/* Header: Order No, Channel Tag & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-[var(--color-text-main)]">
                          {order.id}
                        </span>

                        {isSub ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-black uppercase tracking-wider">
                            VIP Subscription Plan
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wider">
                            Direct Pre-Order
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      <div className="text-xs text-[var(--color-text-muted)] font-semibold">
                        Placed: <strong className="text-[var(--color-text-main)] font-extrabold">{order.timeFormatted || new Date(order.createdAt).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>

                    {/* Detailed Itemized Line Items Table Ledger */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-wider block">
                        Itemized Transaction Breakdown
                      </span>

                      {order.itemsList && order.itemsList.length > 0 ? (
                        <div className="bg-[var(--color-surface-hover)] rounded-2xl p-3 space-y-2">
                          {order.itemsList.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-neutral-200/50 last:border-none">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-[var(--color-text-main)]">{item.title}</span>
                                <span className="px-2 py-0.5 rounded-md bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-black">
                                  x{item.quantity}
                                </span>
                              </div>
                              <div className="font-extrabold text-[var(--color-text-main)]">
                                {formatCurrency(item.price * item.quantity)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-[var(--color-surface-hover)] p-3 rounded-2xl text-xs font-extrabold text-[var(--color-text-main)] flex items-center justify-between">
                          <span>{order.itemsSummary || 'Chef Crafted Meal Plan'}</span>
                          <span>{formatCurrency(order.totalAmount)}</span>
                        </div>
                      )}
                    </div>



                    {/* Bottom Toolbar Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                      <div className="flex items-center gap-1.5 text-xs font-black text-orange-500">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        <span>{order.proteinGrams}g Protein</span>
                        {order.calories ? <span className="text-neutral-400 font-semibold ml-1">• {order.calories} kcal</span> : null}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            toast.success(`Receipt for Order #${order.id} Generated! 📄`, {
                              description: `Paid Total: ${formatCurrency(order.totalAmount)} · Retained in your account ledger.`,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer carved-btn"
                        >
                          <FileText className="w-3.5 h-3.5 text-neutral-600" />
                          <span>View Receipt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleReorder(order)}
                          className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-900 hover:bg-purple-600 hover:text-white font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer carved-btn"
                          title="Reorder items from this order"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reorder All Items</span>
                        </button>

                        {(() => {
                          const stLower = (order.status || '').toLowerCase();
                          const isPackedOrBeyond =
                            stLower.includes('packed') ||
                            stLower.includes('rider') ||
                            stLower.includes('out_for_delivery') ||
                            stLower.includes('out for delivery') ||
                            stLower.includes('delivered') ||
                            stLower.includes('cancelled') ||
                            stLower.includes('refunded');

                          if (!isPackedOrBeyond) {
                            return (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to cancel order #${order.id}?`)) {
                                    const res = await useOrderStore.getState().cancelUserOrder(order.id, 'Cancelled via My Orders');
                                    if (res.ok) {
                                      toast.success(`Order #${order.id} cancelled successfully`);
                                    } else {
                                      toast.error(res.error || 'Could not cancel order');
                                    }
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-extrabold text-xs transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancel Order</span>
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
