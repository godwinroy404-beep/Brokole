import React, { useState, useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { User, MapPin, Heart, Check, LogOut, ArrowRight, Package, Clock, Flame, ShoppingBag, Utensils, CheckCircle2, Truck, RefreshCw, Sparkles, Calendar, PauseCircle, PlayCircle, ShieldCheck, RotateCcw, XCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useOrderStore, OrderStatus } from '../store/useOrderStore';
import { useCartStore } from '../store/useCartStore';
import { ensureAddress } from '../lib/menu';
import { formatCurrency } from '../lib/nutritionParser';
import { toast } from 'sonner';
import { api, isApiConfigured } from '../lib/api';

/** Local YYYY-MM-DD. toISOString() would shift the date across the IST offset. */
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: 'My Account & Subscription Calendar — Bro-Ko-Le' },
      { name: 'description', content: 'Manage your Bro-Ko-Le profile, delivery addresses, meal plan calendar, skip days, and view order history.' },
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

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [dietary, setDietary] = useState<string[]>(user?.dietaryPreferences || ['High Protein']);
  const [isSaving, setIsSaving] = useState(false);

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

    if (!isApiConfigured) {
      // Offline/demo fallback only — never the source of truth.
      try {
        const saved = localStorage.getItem('bkl_skipped_dates');
        setSkippedDates(new Set(saved ? JSON.parse(saved) : []));
      } catch {
        setSkippedDates(new Set());
      }
      setSkipsLoading(false);
      return;
    }

    let alive = true;
    setSkipsLoading(true);

    api
      .get<{ skips: Array<{ skip_date: string }> }>('/me/skips')
      .then(({ skips }) => {
        if (!alive) return;
        // MySQL DATE can come back as "2026-09-08" or "2026-09-08 00:00:00".
        setSkippedDates(new Set(skips.map((s) => String(s.skip_date).slice(0, 10))));
      })
      .catch(() => {
        if (alive) toast.error('Could not load your meal plan calendar');
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

    // Optimistic: flip immediately so the tap feels instant, then put it back
    // if the server disagrees. The previous version wrote to localStorage and
    // swallowed API failures, so the screen could show a skip the kitchen had
    // never been told about.
    const optimistic = new Set(skippedDates);
    if (nextSkipped) optimistic.add(isoDate);
    else optimistic.delete(isoDate);
    setSkippedDates(optimistic);
    setSavingDate(isoDate);

    if (!isApiConfigured) {
      try {
        localStorage.setItem('bkl_skipped_dates', JSON.stringify([...optimistic]));
      } catch { /* ignore */ }
      setSavingDate(null);
      return;
    }

    try {
      // subOrder.id is the display number ("BKL-260904-1042"); the API needs
      // the database key. Sending the wrong one failed the ownership check and
      // surfaced as "That order is not yours".
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
    } catch (e) {
      setSkippedDates(skippedDates);          // revert to the known-good set
      toast.error('Could not save that change', {
        description: e instanceof Error ? e.message : 'Please try again.',
      });
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
    toast.info('Signed out of Bro-Ko-Le');
    navigate({ to: '/' });
  };

  if (!isLoggedIn || !user) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-lg mx-auto text-center space-y-6">
        <div className="bg-[var(--color-surface)] rounded-3xl p-8 shadow-card carved-box space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-xs">
            <User className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
              Sign In to Bro-Ko-Le
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

  const isVipCustomer = orders.some(
    (o) =>
      (o.itemsSummary && (o.itemsSummary.includes('Subscription') || o.itemsSummary.includes('Plan'))) ||
      (o.itemsList && o.itemsList.some((item) => item.title.includes('Subscription') || item.title.includes('Plan'))) ||
      o.totalAmount >= 3000
  );

  const subOrder = orders.find(
    (o) =>
      (o.itemsSummary && (o.itemsSummary.includes('Subscription') || o.itemsSummary.includes('Plan'))) ||
      (o.itemsList && o.itemsList.some((item) => item.title.includes('Subscription') || item.title.includes('Plan')))
  );

  /**
   * The next 7 days, generated from today.
   *
   * This was a hardcoded "Sep 1 … Sep 7" array with "Sep 3 (Today)" baked in,
   * so it drifted out of date the moment the month moved on.
   *
   * The meal names are still placeholders: real per-day meals need the
   * subscription schedule model (plans -> subscription_schedule), which does
   * not exist yet.
   */
  const ROTATION = [
    'Quinoa Paneer Bowl + Berry Smoothie',
    'Grilled Chicken & Brown Rice',
    'High-Protein Oats & Whey Shake',
    'Mediterranean Chicken Wrap',
    'Tofu Energy Salad & Green Juice',
    'Pro Oats Pancakes & Honey Shake',
    'Executive Chef Special Bowl',
  ];

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

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-4 max-w-4xl mx-auto">
      {/* Profile Header Banner */}
      <div className="bg-[var(--color-surface)] rounded-3xl p-6 shadow-xs carved-box">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] flex items-center justify-center font-black text-2xl shadow-md carved-btn shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
                  {user.name || 'Valued Customer'}
                </h1>
                {isVipCustomer ? (
                  <span className="px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase inline-flex items-center gap-1">
                    <span>VIP Subscriber</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">
                    Verified Member
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-semibold mt-0.5">
                {user.email} {user.phone ? `• ${user.phone}` : ''}
              </p>
              {user.address && (
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1 line-clamp-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                  <span>{user.address}</span>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-red-50 text-[var(--color-error)] text-xs font-extrabold hover:bg-red-100 transition-all cursor-pointer shrink-0 carved-btn"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${activeTab === 'profile'
            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-sm'
            : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
            }`}
        >
          <User className="w-4 h-4" />
          <span>My Profile & Address</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${activeTab === 'calendar'
            ? 'bg-emerald-800 text-white shadow-sm'
            : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-emerald-800'
            }`}
        >
          <Calendar className="w-4 h-4 text-emerald-300" />
          <span>Meal Plan Calendar</span>
          {skippedDates.size > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-emerald-950 text-[9px] font-black">
              {skippedDates.size} Skipped
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer relative ${activeTab === 'orders'
            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-sm'
            : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
            }`}
        >
          <Package className="w-4 h-4" />
          <span>Orders & History</span>
          {orders.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'orders'
              ? 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)]'
              : 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
              }`}>
              {orders.length}
            </span>
          )}
        </button>
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

      {/* TAB 2: MEAL PLAN CALENDAR WITH SKIP DAY OPTION */}
      {activeTab === 'calendar' && (
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
                  {subOrder ? (subOrder.itemsSummary || 'Weekly Flex Plan') : 'Bro-Ko-Le Weekly Flex Plan'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-emerald-950/60 p-3 rounded-2xl">
                <span className="text-[10px] text-emerald-300 font-bold block">Active Days</span>
                <span className="text-lg font-black text-white">7 Days</span>
              </div>

              <div className="bg-emerald-950/60 p-3 rounded-2xl">
                <span className="text-[10px] text-emerald-300 font-bold block">Completed</span>
                <span className="text-lg font-black text-emerald-400">2 Days</span>
              </div>

              <div className="bg-emerald-950/60 p-3 rounded-2xl">
                <span className="text-[10px] text-emerald-300 font-bold block">Skipped Days</span>
                <span className="text-lg font-black text-amber-400">{skippedDates.size} Days</span>
              </div>

              <div className="bg-emerald-950/60 p-3 rounded-2xl">
                <span className="text-[10px] text-emerald-300 font-bold block">Extension Bonus</span>
                <span className="text-lg font-black text-emerald-200">+{skippedDates.size} Days</span>
              </div>
            </div>
          </div>

          {/* Compact Days Calendar Grid */}
          <div className="bg-[var(--color-surface)] rounded-3xl p-5 shadow-xs space-y-3 carved-box">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[var(--color-text-main)] flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Weekly Delivery Schedule & Skip Controls</span>
              </h3>
              <span className="text-[11px] text-[var(--color-text-muted)] font-semibold">
                Click Skip / Restore on any day
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {planDays.map((day) => {
                const isSkipped = skippedDates.has(day.iso);
                const isSaving = savingDate === day.iso;

                return (
                  <div
                    key={day.iso}
                    className={`rounded-2xl p-2.5 transition-all space-y-2 flex flex-col justify-between ${day.isPast
                        ? 'bg-emerald-50/60 text-emerald-950'
                        : day.isToday
                          ? 'bg-emerald-50 ring-2 ring-emerald-200 text-emerald-950'
                          : isSkipped
                            ? 'bg-amber-50 text-amber-950'
                            : 'bg-white text-[var(--color-text-main)] shadow-xs'
                      }`}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] ${day.isPast
                              ? 'bg-emerald-600 text-white'
                              : day.isToday
                                ? 'bg-emerald-600 text-white'
                                : isSkipped
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-neutral-100 text-neutral-700'
                            }`}
                        >
                          {day.dayOfMonth}
                        </span>
                        <div>
                          <div className="font-extrabold text-[11px] leading-tight">{day.label}</div>
                          <div className="text-[9px] text-neutral-400 font-semibold">{day.date}</div>
                        </div>
                      </div>

                      {day.isPast ? (
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                          ✓
                        </span>
                      ) : day.isToday ? (
                        <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                      ) : isSkipped ? (
                        <span className="text-[9px] font-black text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded-md">
                          Skipped
                        </span>
                      ) : null}
                    </div>

                    {/* Compact Skip/Unskip Button */}
                    {!day.isPast ? (
                      <button
                        type="button"
                        onClick={() => void toggleSkipDay(day.iso, `${day.label} ${day.date.replace(' (Today)', '')}`)}
                        disabled={isSaving || skipsLoading}
                        className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer carved-btn disabled:opacity-50 disabled:cursor-not-allowed ${isSkipped
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
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
                      <div className="py-1.5 text-center text-[9px] font-extrabold text-emerald-700 bg-emerald-100/60 rounded-xl">
                        Delivered
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Previous Orders & Order History */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--color-text-main)] flex items-center gap-2">
              <span>Order History</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black">
                {orders.length}
              </span>
            </h2>
            <button
              onClick={() => void loadMyOrders()}
              className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Orders</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="bg-[var(--color-surface)] rounded-3xl p-10 text-center max-w-md mx-auto carved-box space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-main)]">No previous orders yet</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Once you place a pre-order, your full order history and live dispatch status will be tracked here.
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
            <div className="space-y-2.5">
              {orders.map((order) => {
                const badge = getStatusBadgeStyle(order.status);
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={order.id}
                    className="bg-[var(--color-surface)] rounded-2xl p-3 shadow-2xs space-y-2 carved-box transition-all"
                  >
                    {/* Header: Order No, Status & Total Amount */}
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-[var(--color-text-main)]">
                          {order.id}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${badge.bg}`}>
                          <BadgeIcon className="w-2.5 h-2.5" />
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                          • {order.timeFormatted || new Date(order.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-right shrink-0">
                        <span className="text-xs font-black text-orange-500 uppercase flex items-center gap-0.5">
                          <Flame className="w-3 h-3 text-orange-500" />
                          {order.proteinGrams}g Protein
                          {order.calories ? <span className="text-neutral-400 font-semibold ml-1">• {order.calories} kcal</span> : null}
                        </span>
                        <span className="text-sm font-black text-[var(--color-primary)]">
                          {formatCurrency(order.totalAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleReorder(order)}
                          className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-900 hover:bg-purple-600 hover:text-white font-extrabold text-[10px] transition-all flex items-center gap-1 cursor-pointer carved-btn"
                          title="Reorder items from this order"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reorder</span>
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

                          const isCancellable = !isPackedOrBeyond;

                          if (isCancellable) {
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
                                className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-extrabold text-[9px] transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-2.5 h-2.5" />
                                <span>Cancel Order</span>
                              </button>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Compact Items List */}
                    <div className="text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-2.5 py-1.5 rounded-xl flex flex-wrap items-center justify-between gap-1">
                      {order.itemsList && order.itemsList.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {order.itemsList.map((item, idx) => (
                            <span key={idx} className="text-[var(--color-text-main)] font-extrabold">
                              {item.title} <span className="text-[var(--color-primary)] font-black">x{item.quantity}</span>
                              {idx < (order.itemsList?.length ?? 0) - 1 ? <span className="text-neutral-300 font-normal ml-2">•</span> : null}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-main)] font-extrabold">
                          {order.itemsSummary || 'Chef Crafted Meal'}
                        </span>
                      )}
                    </div>

                    {/* Delivery Address */}
                    {order.customerAddress && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] font-medium pt-1">
                        <MapPin className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                        <span className="truncate">{order.customerAddress}</span>
                      </div>
                    )}
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
