import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useAuthStore } from '../store/useAuthStore';
import { useOrderStore } from '../store/useOrderStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { useMacroStore } from '../store/useMacroStore';
import { useProductStore } from '../store/useProductStore';
import { Product } from '../lib/shopify';
import { formatCurrency } from '../lib/nutritionParser';
import { pushLocalOrderSync } from '../lib/localSync';
import { pushCloudOrder } from '../lib/cloudOrderSync';
import {
  Calendar,
  Sparkles,
  Check,
  Zap,
  Flame,
  ShieldCheck,
  Clock,
  ChevronRight,
  Utensils,
  Award,
  Scale,
  Dumbbell,
  Target,
  X,
  ArrowRight,
  Search,
  BookOpen,
  ChevronDown,
  CheckCircle2,
  Phone,
  MapPin,
  User,
  CreditCard,
  Lock,
  PauseCircle,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  tomorrowPrice: number;
  weeklyPrice: number;
  monthlyPrice: number;
  mealsPerDay: number;
  proteinPerDay: number;
  caloriesPerDay: number;
  popular?: boolean;
  features: string[];
  badge?: string;
}

export interface FitnessGoalOption {
  id: string;
  label: string;
  badge: string;
  icon: any;
  desc: string;
  dietMatch: string;
}

const FITNESS_GOALS: FitnessGoalOption[] = [
  {
    id: 'weight_loss',
    label: 'Fat Loss & Lean Shred',
    badge: '🔥 Fat Burn',
    icon: Scale,
    desc: 'Calorie-controlled, high-protein & fiber meals engineered to accelerate fat burn.',
    dietMatch: 'Keto / Low Carb',
  },
  {
    id: 'muscle_gain',
    label: 'Muscle Build & Hypertrophy',
    badge: '💪 Muscle Gain',
    icon: Dumbbell,
    desc: 'High-protein, amino-dense meal portions tailored for muscle growth & recovery.',
    dietMatch: 'High Protein',
  },
  {
    id: 'maintenance',
    label: 'Weight Maintenance & Wellness',
    badge: '⚖️ Balanced Fit',
    icon: Target,
    desc: 'Balanced protein, carbs & fats designed to maintain current weight & daily energy.',
    dietMatch: 'Balanced Fit',
  },
  {
    id: 'athletic',
    label: 'Athletic Performance & Energy',
    badge: '⚡ Peak Performance',
    icon: Zap,
    desc: 'Clean complex carbs & protein fueling intense workouts, stamina & endurance.',
    dietMatch: 'High Protein',
  },
];

const SUBSCRIPTION_PLANS: PlanTier[] = [
  {
    id: 'plan-weekly-flex',
    name: 'Weekly Flex Plan',
    tagline: 'Ideal for trying out macro-balanced eating with complete daily flexibility.',
    tomorrowPrice: 299,
    weeklyPrice: 1899,
    monthlyPrice: 5999,
    mealsPerDay: 2,
    proteinPerDay: 75,
    caloriesPerDay: 580,
    features: [
      '2 Chef & Dietitian meals daily (Lunch + Dinner)',
      'Free VIP pre-order delivery to your doorstep',
      'Pause, skip, or restore meals anytime via app calendar',
      'Macro breakdown report included per delivery',
    ],
  },
  {
    id: 'plan-shred-gain',
    name: 'Shred & Gain Pro',
    tagline: 'Our #1 most popular plan for rapid fitness transformation and muscle hypertrophy.',
    tomorrowPrice: 399,
    weeklyPrice: 2399,
    monthlyPrice: 7499,
    mealsPerDay: 2,
    proteinPerDay: 95,
    caloriesPerDay: 680,
    popular: true,
    badge: 'SAVE 25% MONTHLY',
    features: [
      '2 High-Protein chef meals + 1 Free Detox Shake daily',
      '1-on-1 Personal Dietitian macro consultation',
      'Priority pre-order delivery window',
      'Free custom substitution & ingredient tailoring',
      'Weekly progress check-in & calorie adjustment',
    ],
  },
  {
    id: 'plan-athlete-pro',
    name: 'Elite Athlete Plan',
    tagline: 'Complete 3-meal daily nutrition suite engineered for serious athletes.',
    tomorrowPrice: 499,
    weeklyPrice: 2899,
    monthlyPrice: 8999,
    mealsPerDay: 3,
    proteinPerDay: 130,
    caloriesPerDay: 850,
    features: [
      '3 Full chef meals daily (Breakfast, Lunch, Dinner)',
      '130g+ Daily protein target with double-portion option',
      'Dedicated personal nutrition coach & WhatsApp support',
      'Exclusive access to secret off-menu chef specials',
      'Zero delivery fees + guaranteed pre-order delivery',
    ],
  },
];

export const SubscriptionPlans: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, openAuthModal, updateUser } = useAuthStore();
  const { orders, addOrder, loadMyOrders, extendSubscriptionOrder } = useOrderStore();
  const upsertCustomer = useCustomerStore((state) => state.upsertCustomer);
  const setMacroProfile = useMacroStore((state) => state.setProfile);
  const macroProfile = useMacroStore((state) => state.profile);

  const storeProducts = useProductStore((state) => state.products);
  const loadProducts = useProductStore((state) => state.loadProducts);

  const [billingCycle, setBillingCycle] = useState<'tomorrow' | 'weekly' | 'monthly'>('weekly');
  const [selectedDiet, setSelectedDiet] = useState<string>('High Protein');
  const [selectedSlot, setSelectedSlot] = useState<string>('Lunch & Dinner (12 PM & 7 PM)');

  // Full Menu Picker State
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // Custom Meal Select Dropdown State
  const [isMealDropdownOpen, setIsMealDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pre-Order for Tomorrow State
  const [tomorrowSlot, setTomorrowSlot] = useState<string>('Lunch (12:00 PM - 2:00 PM)');
  const [selectedTomorrowMeal, setSelectedTomorrowMeal] = useState<{
    id: string;
    name: string;
    price: number;
    protein: number;
    calories: number;
    image: string;
  }>({
    id: '',
    name: '',
    price: 0,
    protein: 0,
    calories: 0,
    image: '',
  });

  // Dedicated Activation Popup Modal State
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [selectedPlanForActivation, setSelectedPlanForActivation] = useState<PlanTier | null>(null);
  const [activationCycle, setActivationCycle] = useState<'tomorrow' | 'weekly' | 'monthly'>('weekly');
  const [activationGoalId, setActivationGoalId] = useState<string>('muscle_gain');
  const [activationDiet, setActivationDiet] = useState<string>('High Protein');
  const [activationSlot, setActivationSlot] = useState<string>('Lunch & Dinner (12 PM & 7 PM)');
  const [activationMode, setActivationMode] = useState<'new' | 'switch' | 'extend'>('new');

  // Plan Warning / Decision Modal State (for Extend or Switch)
  const [planWarningModal, setPlanWarningModal] = useState<{
    isOpen: boolean;
    type: 'extend' | 'switch';
    plan: PlanTier;
    cycle: 'tomorrow' | 'weekly' | 'monthly';
    activeSub: any;
  } | null>(null);
  
  // Checkout Form Details in Modal
  const [custName, setCustName] = useState(user?.name || '');
  const [custPhone, setCustPhone] = useState(user?.phone || '');
  const [custAddress, setCustAddress] = useState(user?.address || '');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (user) {
      if (!custName && user.name) setCustName(user.name);
      if (!custPhone && user.phone) setCustPhone(user.phone);
      if (!custAddress && user.address) setCustAddress(user.address);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMealDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadProducts();
    void loadMyOrders();
  }, [loadProducts, loadMyOrders]);

  const TOMORROW_MEALS = [
    {
      id: 'pre-chicken-rice',
      name: 'High-Protein Chicken & Brown Rice Bowl',
      price: 360,
      protein: 48,
      calories: 580,
      image: '/images/grilled_chicken_bowl.png',
    },
    {
      id: 'pre-quinoa-paneer',
      name: 'Quinoa Paneer Fitness Bowl',
      price: 380,
      protein: 42,
      calories: 520,
      image: '/images/quinoa_paneer_bowl.png',
    },
    {
      id: 'pre-salmon-power',
      name: 'Grilled Atlantic Salmon & Roasted Veggies',
      price: 450,
      protein: 52,
      calories: 610,
      image: '/images/salmon_bowl.png',
    },
  ];

  const tomorrowObj = new Date(Date.now() + 86400000);
  const formattedTomorrow = tomorrowObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Check if current user has an active subscription
  const activeSubOrder = useMemo(() => {
    return orders.find((o) => {
      if ((o as any).deleted) return false;
      const st = (o.status || '').toLowerCase();
      if (st.includes('cancel') || st.includes('refund')) return false;
      const isSub =
        (o.itemsSummary && (
          o.itemsSummary.toLowerCase().includes('plan') ||
          o.itemsSummary.toLowerCase().includes('subscription') ||
          o.itemsSummary.toLowerCase().includes('weekly') ||
          o.itemsSummary.toLowerCase().includes('monthly') ||
          o.itemsSummary.toLowerCase().includes('shred')
        )) ||
        (o.itemsList && o.itemsList.some((item) => {
          const t = (item.title || '').toLowerCase();
          return t.includes('plan') || t.includes('sub') || t.includes('weekly') || t.includes('monthly');
        }));
      return isSub;
    });
  }, [orders]);

  // Open the Subscription Activation Popup Modal
  const handleOpenSubscribeModal = (
    plan: PlanTier,
    cycleOverride?: 'tomorrow' | 'weekly' | 'monthly',
    mode: 'new' | 'switch' | 'extend' = 'new'
  ) => {
    const cycle = cycleOverride || billingCycle;
    setSelectedPlanForActivation(plan);
    setActivationCycle(cycle);
    setActivationDiet(selectedDiet);
    setActivationSlot(cycle === 'tomorrow' ? tomorrowSlot : selectedSlot);
    setActivationGoalId(macroProfile.goal || (plan.id === 'plan-shred-gain' ? 'muscle_gain' : 'weight_loss'));
    setActivationMode(mode);
    if (user) {
      setCustName(user.name || '');
      setCustPhone(user.phone || '');
      setCustAddress(user.address || '');
    }
    setIsActivationModalOpen(true);
  };

  // Intercept subscription clicks to warn existing subscribers and offer Extend or Switch
  const handlePlanButtonClick = (plan: PlanTier, cycleOverride?: 'tomorrow' | 'weekly' | 'monthly') => {
    const cycle = cycleOverride || billingCycle;

    if (!activeSubOrder) {
      handleOpenSubscribeModal(plan, cycle, 'new');
      return;
    }

    const activeSummary = (
      activeSubOrder.itemsSummary ||
      (activeSubOrder.itemsList && activeSubOrder.itemsList[0]?.title) ||
      ''
    ).toLowerCase();
    const planNameLower = plan.name.toLowerCase();

    // Determine if the user is selecting the same plan tier
    const isSamePlan =
      (planNameLower.includes('weekly flex') && activeSummary.includes('weekly flex')) ||
      (planNameLower.includes('shred & gain') && activeSummary.includes('shred & gain')) ||
      (planNameLower.includes('athlete') && activeSummary.includes('athlete')) ||
      activeSummary.includes(planNameLower);

    if (isSamePlan) {
      // User has SAME plan active -> prompt with Extension option
      setPlanWarningModal({
        isOpen: true,
        type: 'extend',
        plan,
        cycle,
        activeSub: activeSubOrder,
      });
    } else {
      // User is selecting a DIFFERENT plan -> prompt with Switch Plan option
      setPlanWarningModal({
        isOpen: true,
        type: 'switch',
        plan,
        cycle,
        activeSub: activeSubOrder,
      });
    }
  };

  // Quick 1-click Extension Handler
  const handleConfirmExtension = async (plan: PlanTier, cycle: 'tomorrow' | 'weekly' | 'monthly') => {
    if (!activeSubOrder) return;
    const addedDays = cycle === 'monthly' ? 30 : cycle === 'tomorrow' ? 1 : 7;
    const price = cycle === 'monthly' ? plan.monthlyPrice : cycle === 'tomorrow' ? plan.tomorrowPrice : plan.weeklyPrice;
    const updatedSummary = `Brokole ${plan.name} (+${addedDays} Days Extended)`;

    extendSubscriptionOrder(activeSubOrder.id, addedDays, price, updatedSummary);

    toast.success(`🎉 Subscription Extended (+${addedDays} Days)!`, {
      description: `Added ${addedDays} delivery days to your active ${plan.name} schedule.`,
      duration: 5000,
    });

    setPlanWarningModal(null);
    navigate({ to: '/account' });
  };

  // Confirm and directly activate the subscription (NO BASKET ROUTING, NO DUPLICATE CREATION)
  const handleConfirmAndActivate = async () => {
    if (!selectedPlanForActivation) return;

    if (!custName.trim()) {
      toast.error('Please provide your full name');
      return;
    }
    if (!custPhone.trim()) {
      toast.error('Please provide your mobile phone number for delivery updates');
      return;
    }
    if (!custAddress.trim() || custAddress.trim().length < 5) {
      toast.error('Please provide a complete delivery address');
      return;
    }

    setIsActivating(true);

    try {
      const plan = selectedPlanForActivation;
      const isTomorrow = activationCycle === 'tomorrow';
      const isMonthly = activationCycle === 'monthly';
      const price = isTomorrow ? plan.tomorrowPrice : (isMonthly ? plan.monthlyPrice : plan.weeklyPrice);
      const durationLabel = isTomorrow
        ? `Single-Day Pre-Order (${formattedTomorrow})`
        : isMonthly
        ? '30-Day Monthly'
        : '7-Day Weekly';

      const goal = FITNESS_GOALS.find((g) => g.id === activationGoalId) || FITNESS_GOALS[0];

      // Update user & macro store
      updateUser({
        name: custName,
        phone: custPhone,
        address: custAddress,
        dietaryPreferences: [activationDiet],
      });
      setMacroProfile({ goal: goal.id as any });

      upsertCustomer({
        name: custName,
        email: user?.email,
        phone: custPhone,
        address: custAddress,
        dietary: [activationDiet],
        spentAmount: price,
      });

      // If switching plans, gracefully cancel/deactivate previous active subscription
      if ((activationMode === 'switch' || activationMode === 'new') && activeSubOrder) {
        useOrderStore.getState().updateOrderStatus(activeSubOrder.id, 'Cancelled');
      }

      const subOrderNo = `BKL-SUB-${Math.floor(100 + Math.random() * 900)}`;
      const subTitle = `Brokole ${plan.name} (${durationLabel})`;
      const subNotes = `${goal.label} Goal Plan | ${activationDiet} | ${activationSlot}`;

      // Create single live order cleanly through addOrder (which syncs locally and to cloud once)
      addOrder({
        id: subOrderNo,
        serverId: subOrderNo,
        userId: user?.id || `usr-${Date.now()}`,
        userEmail: user?.email || `${custName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
        customerName: custName,
        customerPhone: custPhone,
        customerAddress: custAddress,
        itemsSummary: subTitle,
        itemsList: [
          {
            title: subTitle,
            quantity: 1,
            price,
          },
        ],
        lines: [
          {
            name_snapshot: subTitle,
            quantity: 1,
            unit_price: String(price),
            line_total: String(price),
            notes: goal.label,
          },
        ],
        totalAmount: price,
        proteinGrams: plan.proteinPerDay,
        calories: plan.caloriesPerDay,
        channel: 'subscription',
        notes: subNotes,
        status: 'Preparing',
      });

      toast.success(
        activationMode === 'switch'
          ? `🎉 Switched to ${plan.name} Successfully!`
          : `🎉 ${plan.name} Activated Successfully!`,
        {
          description: `Order #${subOrderNo} confirmed. View your active meal calendar & skip days in your account.`,
          duration: 5000,
        }
      );

      setIsActivationModalOpen(false);
      setSelectedPlanForActivation(null);
      setActivationMode('new');

      // Navigate to Account page with calendar active
      navigate({ to: '/account' });
    } catch (err: any) {
      toast.error('Could not activate subscription: ' + (err?.message || 'Please try again'));
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 🌟 HERO BANNER / ACTIVE SUBSCRIPTION STATUS */}
      {activeSubOrder ? (
        <div className="bg-gradient-to-r from-purple-950 via-neutral-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-card relative overflow-hidden border border-purple-500/30">
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/30 text-purple-200 text-xs font-black border border-purple-500/40">
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>ACTIVE VIP SUBSCRIPTION • #{activeSubOrder.id}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {activeSubOrder.itemsSummary || 'Brokole Shred & Gain Pro'}
              </h2>
              <p className="text-xs sm:text-sm text-purple-200/90 font-medium">
                Your daily chef-crafted macro meals are active. You can pause or skip upcoming days anytime.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  🔥 {activeSubOrder.proteinGrams || 75}g Daily Protein
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-200 font-bold border border-purple-500/30">
                  🚚 Free Priority Dispatch
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <Link
                to="/account"
                className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer carved-btn"
              >
                <Calendar className="w-4 h-4" />
                <span>Open Meal Calendar & Skip Days</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-3xl p-6 sm:p-10 shadow-card relative overflow-hidden carved-box">
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-[var(--color-primary-muted)] opacity-30 blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-[var(--color-primary-muted)] text-[var(--color-accent)] text-xs font-black mb-3 border border-[var(--color-accent-glow)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Brokole Subscription Studio</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Put Your Nutrition on Autopilot <br className="hidden sm:inline" />
              <span className="text-[var(--color-accent)]">Save Up to 25% Every Month</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-2 leading-relaxed max-w-xl">
              Fresh chef-prepared, dietitian-formulated meals delivered directly to your doorstep. Pause, skip days, or modify anytime with 1 click.
            </p>
          </div>
        </div>
      )}

      {/* 🚀 BOOK FOR TOMORROW PRE-ORDER SECTION */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 shadow-card relative space-y-6 carved-box">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--color-primary-light)] opacity-40 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black mb-2 border border-[var(--color-primary-muted)]/20">
              <Clock className="w-3.5 h-3.5 animate-pulse text-[var(--color-accent)]" />
              <span>NEXT-DAY KITCHEN PRE-ORDER</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--color-text-main)] flex items-center gap-2">
              <span>Book Meal Delivery for Tomorrow</span>
              <span className="px-2.5 py-0.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-on-accent)] text-xs font-black uppercase">
                {formattedTomorrow}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] font-medium mt-1">
              Guarantee fresh dietitian-formulated meal dispatch directly to your doorstep tomorrow.
            </p>
          </div>

          <div className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl px-4 py-2.5 text-center sm:text-right shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-primary)] block">
              Kitchen Pre-Order Cutoff
            </span>
            <span className="text-xs font-mono font-bold text-[var(--color-text-main)]">
              Order within <strong className="text-[var(--color-primary)] font-black">04h : 18m : 30s</strong> for guaranteed tomorrow dispatch
            </span>
          </div>
        </div>

        {/* Dispatch Slot & Meal Pick Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
          
          {/* Left Column: Delivery Slot Selector */}
          <div className="lg:col-span-5 space-y-4">
            <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>1. Select Tomorrow's Dispatch Slot</span>
            </label>

            <div className="space-y-2">
              {[
                { slot: 'Lunch (12:00 PM - 2:00 PM)', label: '🍳 Lunch Dispatch', time: '12 PM - 2 PM' },
                { slot: 'Dinner (7:00 PM - 9:00 PM)', label: '🌆 Dinner Dispatch', time: '7 PM - 9 PM' },
                { slot: 'Morning (8:00 AM - 10:00 AM)', label: '🌅 Morning Dispatch', time: '8 AM - 10 AM' },
              ].map((s) => {
                const isSelected = tomorrowSlot === s.slot;
                return (
                  <button
                    key={s.slot}
                    type="button"
                    onClick={() => setTomorrowSlot(s.slot)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between carved-btn ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)] font-extrabold shadow-xs ring-1 ring-[var(--color-primary-muted)]'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-xs block text-[var(--color-text-main)]">{s.label}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">{s.time}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Pre-Order Meal Selection */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5" />
                <span>2. Select Meal for Tomorrow</span>
              </label>

              <button
                type="button"
                onClick={() => setIsMenuModalOpen(true)}
                className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent-hover)]" />
                <span>Browse Full Menu ({storeProducts.length})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TOMORROW_MEALS.map((meal) => {
                const isSelected = selectedTomorrowMeal.id === meal.id;
                return (
                  <div
                    key={meal.id}
                    onClick={() => setSelectedTomorrowMeal(meal)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between carved-btn ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] ring-2 ring-[var(--color-accent-glow)] shadow-xs'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                    }`}
                  >
                    <div className="space-y-2">
                      <img
                        src={meal.image}
                        alt={meal.name}
                        className="w-full h-20 rounded-xl object-cover border border-[var(--color-border)] shadow-xs"
                      />
                      <div>
                        <span className="text-xs font-extrabold text-[var(--color-text-main)] line-clamp-2 leading-snug">
                          {meal.name}
                        </span>
                        <span className="text-[10px] text-[var(--color-primary)] font-bold block mt-1">
                          🔥 {meal.protein}g Protein · {meal.calories} kcal
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-[var(--color-border)] mt-2">
                      <span className="text-xs font-black text-[var(--color-text-main)]">{formatCurrency(meal.price)}</span>
                      {isSelected ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[var(--color-accent)] text-[var(--color-text-on-accent)]">
                          SELECTED
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-[var(--color-text-muted)]">Select</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compact Menu Select & Pre-Book Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              
              {/* Custom Styled Meal Select Dropdown */}
              <div className="relative w-full sm:w-72 shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMealDropdownOpen(!isMealDropdownOpen)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-muted)] text-xs font-extrabold text-[var(--color-text-main)] transition-all cursor-pointer shadow-xs flex items-center justify-between gap-2 carved-btn"
                >
                  <div className="flex items-center gap-2 truncate">
                    {selectedTomorrowMeal.name && selectedTomorrowMeal.image ? (
                      <img
                        src={selectedTomorrowMeal.image}
                        alt=""
                        className="size-5 rounded-md object-cover shrink-0 border border-[var(--color-border)]"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/hero_bowl.png';
                        }}
                      />
                    ) : (
                      <Utensils className="size-3.5 text-[var(--color-primary)] shrink-0" />
                    )}
                    <span className="truncate font-bold">
                      {selectedTomorrowMeal.name || '-- Select Meal --'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedTomorrowMeal.price > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                        {formatCurrency(selectedTomorrowMeal.price)}
                      </span>
                    )}
                    <ChevronDown className={`size-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isMealDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Popover */}
                {isMealDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-full sm:w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl z-[100] overflow-hidden animate-fade-in carved-box">
                    <div className="p-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]">
                      <div className="relative">
                        <Search className="size-3.5 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search meals..."
                          value={dropdownSearch}
                          onChange={(e) => setDropdownSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto no-scrollbar p-1.5 space-y-1">
                      {storeProducts
                        .filter((p) =>
                          !dropdownSearch || p.title.toLowerCase().includes(dropdownSearch.toLowerCase())
                        )
                        .map((p) => {
                          const mealPrice = parseFloat(p.priceRange.minVariantPrice.amount);
                          const isSelected = selectedTomorrowMeal.id === p.id;

                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedTomorrowMeal({
                                  id: p.id,
                                  name: p.title,
                                  price: mealPrice,
                                  protein: p.nutrition.protein,
                                  calories: p.nutrition.calories,
                                  image: p.featuredImage.url,
                                });
                                setIsMealDropdownOpen(false);
                                setDropdownSearch('');
                              }}
                              className={`w-full p-2 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                                isSelected
                                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-black'
                                  : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={p.featuredImage.url}
                                  alt={p.title}
                                  className="size-8 rounded-lg object-cover border border-[var(--color-border)] shrink-0 bg-white"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = '/images/hero_bowl.png';
                                  }}
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-extrabold block truncate leading-tight">
                                    {p.title}
                                  </span>
                                  <span className="text-[10px] text-[var(--color-text-muted)] font-medium block">
                                    {p.nutrition.protein}g Protein · {p.nutrition.calories} kcal
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs font-black text-[var(--color-text-main)]">
                                  {formatCurrency(mealPrice)}
                                </span>
                                {isSelected && <Check className="size-4 text-[var(--color-primary)] stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button - Opens dedicated popup */}
              <button
                type="button"
                onClick={() => {
                  const fallbackPlan: PlanTier = {
                    id: 'plan-single-preorder',
                    name: selectedTomorrowMeal.name ? `${selectedTomorrowMeal.name} (Tomorrow Delivery)` : 'Tomorrow Single-Day Meal',
                    tagline: `Pre-booked for tomorrow dispatch (${formattedTomorrow})`,
                    tomorrowPrice: selectedTomorrowMeal.price || 360,
                    weeklyPrice: 1899,
                    monthlyPrice: 5999,
                    mealsPerDay: 1,
                    proteinPerDay: selectedTomorrowMeal.protein || 48,
                    caloriesPerDay: selectedTomorrowMeal.calories || 580,
                    features: [
                      `Guaranteed dispatch tomorrow (${formattedTomorrow})`,
                      `Delivery window: ${tomorrowSlot}`,
                      'Hot & fresh dietitian-formulated meal',
                    ],
                  };
                  handlePlanButtonClick(fallbackPlan, 'tomorrow');
                }}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99] carved-btn shrink-0"
              >
                <span>
                  {selectedTomorrowMeal.name
                    ? `Pre-Book ${selectedTomorrowMeal.name} for Tomorrow (${formatCurrency(selectedTomorrowMeal.price)})`
                    : 'Pre-Book Meal for Tomorrow'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* Cycle Toggle & Customizers */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs carved-box space-y-6">
        
        {/* Billing Cycle Switcher */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-6">
          <div>
            <span className="text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider block mb-1">
              Select Subscription Duration
            </span>
            <h3 className="text-base font-extrabold text-[var(--color-text-main)] flex items-center gap-2 flex-wrap">
              {billingCycle === 'tomorrow' ? (
                <>
                  <span className="text-[var(--color-primary)] font-black">Book for Tomorrow ({formattedTomorrow})</span>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--color-accent)] text-[var(--color-text-on-accent)] text-[10px] font-black uppercase">Single-Day Trial</span>
                </>
              ) : billingCycle === 'monthly' ? (
                'Monthly Plan (Save 25%)'
              ) : (
                'Weekly Flex Plan (7 Days)'
              )}
            </h3>
          </div>

          <div className="flex items-center bg-[var(--color-surface-hover)] p-1.5 rounded-2xl border border-[var(--color-border)] flex-wrap justify-center sm:flex-nowrap gap-1">
            <button
              onClick={() => setBillingCycle('tomorrow')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'tomorrow'
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)] shadow-md'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <span>Tomorrow</span>
              <span className="px-1.5 py-0.5 rounded-md bg-black/10 text-[9px] font-black uppercase">
                1-Day
              </span>
            </button>

            <button
              onClick={() => setBillingCycle('weekly')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                billingCycle === 'weekly'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              Weekly (7 Days)
            </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'monthly'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <span>Monthly (30 Days)</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-accent)] text-[var(--color-text-on-accent)] text-[9px] font-black">
                -25%
              </span>
            </button>
          </div>
        </div>

        {/* Dietary & Delivery Window Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Dietary Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase">
              1. Choose Dietary Goal
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['High Protein', 'Keto / Low Carb', 'Pure Vegan', 'Balanced Fit'].map((diet) => {
                const isSelected = selectedDiet === diet;
                return (
                  <button
                    key={diet}
                    onClick={() => setSelectedDiet(diet)}
                    className={`p-3 rounded-2xl border text-xs font-extrabold text-left transition-all cursor-pointer carved-btn flex items-center justify-between ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span>{diet}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delivery Slot Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase">
              2. Preferred Delivery Slot
            </label>
            <div className="space-y-2">
              {[
                'Lunch & Dinner (12 PM & 7 PM)',
                'Morning & Evening (8 AM & 6 PM)',
                'All-Day 3-Meal Dispatch (8 AM, 1 PM, 7 PM)',
              ].map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`w-full p-3 rounded-2xl border text-xs font-extrabold text-left transition-all cursor-pointer carved-btn flex items-center justify-between ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span className="truncate">{slot}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Subscription Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isTomorrow = billingCycle === 'tomorrow';
          const isMonthly = billingCycle === 'monthly';
          const price = isTomorrow ? plan.tomorrowPrice : (isMonthly ? plan.monthlyPrice : plan.weeklyPrice);
          const perMealPrice = Math.round(price / (isTomorrow ? plan.mealsPerDay : (isMonthly ? plan.mealsPerDay * 30 : plan.mealsPerDay * 7)));

          return (
            <div
              key={plan.id}
              className={`relative bg-[var(--color-surface)] border rounded-3xl p-6 sm:p-8 shadow-card flex flex-col justify-between transition-all carved-box ${
                isTomorrow
                  ? 'border-2 border-[var(--color-accent)] shadow-lg ring-2 ring-[var(--color-accent-glow)]'
                  : plan.popular
                  ? 'border-2 border-[var(--color-primary)] shadow-lg ring-2 ring-[var(--color-accent-glow)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
              }`}
            >
              {/* Popular / Tomorrow Badge */}
              {isTomorrow ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[var(--color-accent)] text-[var(--color-text-on-accent)] px-3.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-md whitespace-nowrap z-10">
                  Single-Day Pre-Order • {formattedTomorrow}
                </div>
              ) : plan.badge ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[var(--color-accent)] text-[var(--color-text-on-accent)] px-3.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-md whitespace-nowrap z-10">
                  {plan.badge}
                </div>
              ) : null}

              <div className="space-y-4">
                
                {/* Header Title */}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-[var(--color-text-main)] tracking-tight">
                      {plan.name}
                    </h3>
                    <span className="px-2.5 py-1 rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)] font-extrabold text-xs">
                      {plan.proteinPerDay}g P/Day
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1 leading-relaxed">
                    {plan.tagline}
                  </p>
                </div>

                {/* Price Display */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[var(--color-text-main)]">
                      {formatCurrency(price)}
                    </span>
                    <span className="text-xs font-bold text-[var(--color-text-muted)]">
                      / {isTomorrow ? 'single-day trial' : (isMonthly ? 'month' : 'week')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-[var(--color-primary)]">
                    <span>Includes {plan.mealsPerDay} meals {isTomorrow ? `for Tomorrow (${formattedTomorrow})` : 'daily'}</span>
                    <span>~{formatCurrency(perMealPrice)}/meal</span>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 pt-2">
                  <span className="block text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider">
                    Included Benefits:
                  </span>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-[var(--color-text-main)] font-semibold">
                      <div className="w-4 h-4 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        ✓
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

              </div>

              {/* Action Button - Intercepts to handle Extend/Switch Warning or Open Activation Modal */}
              <div className="pt-6 border-t border-[var(--color-border-subtle)] mt-6">
                <button
                  onClick={() => handlePlanButtonClick(plan, billingCycle)}
                  className={`w-full py-4 px-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn ${
                    isTomorrow || plan.popular
                      ? 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)]'
                      : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
                  }`}
                >
                  <span>{isTomorrow ? `Pre-Book for Tomorrow (${formatCurrency(plan.tomorrowPrice)})` : `Subscribe to ${plan.name}`}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Guarantee Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs carved-box flex items-center gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-[var(--color-text-main)]">Pre-Order Delivery</h4>
            <p className="text-[11px] text-[var(--color-text-muted)]">Hot, fresh meals arrive in your selected pre-order window.</p>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs carved-box flex items-center gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-[var(--color-text-main)]">Pause or Cancel Anytime</h4>
            <p className="text-[11px] text-[var(--color-text-muted)]">No long-term lock-in. Manage with 1-click in account.</p>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs carved-box flex items-center gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-[var(--color-text-main)]">Certified Dietitian Support</h4>
            <p className="text-[11px] text-[var(--color-text-muted)]">Custom macro targets tailored to your exact goal.</p>
          </div>
        </div>
      </div>

      {/* ⚠️ PLAN WARNING & DECISION MODAL (EXTEND VS SWITCH) */}
      {planWarningModal && planWarningModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative space-y-5 animate-scale-in carved-box">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
              <div className="space-y-1.5">
                {planWarningModal.type === 'extend' ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                    <span>Active Subscription Detected</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-300 text-xs font-black uppercase">
                    <RefreshCw className="w-3.5 h-3.5 text-purple-700 animate-spin" />
                    <span>Switch Subscription Plan</span>
                  </div>
                )}
                <h3 className="text-lg sm:text-xl font-black text-[var(--color-text-main)] tracking-tight">
                  {planWarningModal.type === 'extend'
                    ? 'Extend Your Active Subscription?'
                    : `Switch to ${planWarningModal.plan.name}?`}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed">
                  {planWarningModal.type === 'extend'
                    ? `You already have an active subscription for ${planWarningModal.activeSub.itemsSummary || planWarningModal.plan.name}. Do you want to extend your plan and add days to your existing schedule?`
                    : `You currently have an active ${planWarningModal.activeSub.itemsSummary || 'VIP'} subscription. Would you like to switch your schedule to ${planWarningModal.plan.name}?`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPlanWarningModal(null)}
                className="p-2 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Active Plan Status Card */}
            <div className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-primary)] block">
                Currently Active on Your Account:
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-extrabold text-[var(--color-text-main)] block">
                    {planWarningModal.activeSub.itemsSummary || 'Brokole Meal Plan'}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] font-semibold">
                    Order #{planWarningModal.activeSub.id} • {planWarningModal.activeSub.proteinGrams || 75}g Protein / Day
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                  ACTIVE VIP
                </span>
              </div>
            </div>

            {/* Content for Extension Mode */}
            {planWarningModal.type === 'extend' ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-950">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                      <span>Extension Duration:</span>
                    </span>
                    <span className="font-black text-emerald-800 text-sm">
                      +{planWarningModal.cycle === 'monthly' ? '30 Days' : planWarningModal.cycle === 'tomorrow' ? '1 Day' : '7 Days'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-emerald-950 pt-1 border-t border-emerald-500/20">
                    <span>Extension Amount:</span>
                    <span className="font-black text-emerald-900 text-sm">
                      {formatCurrency(
                        planWarningModal.cycle === 'monthly'
                          ? planWarningModal.plan.monthlyPrice
                          : planWarningModal.cycle === 'tomorrow'
                          ? planWarningModal.plan.tomorrowPrice
                          : planWarningModal.plan.weeklyPrice
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 font-medium pt-1">
                    ✨ Extends your active meal schedule without creating duplicate orders or interrupting existing delivery days.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmExtension(planWarningModal.plan, planWarningModal.cycle)}
                    className="flex-1 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>
                      Extend Subscription (+
                      {planWarningModal.cycle === 'monthly' ? '30 Days' : planWarningModal.cycle === 'tomorrow' ? '1 Day' : '7 Days'})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const plan = planWarningModal.plan;
                      const cycle = planWarningModal.cycle;
                      setPlanWarningModal(null);
                      handleOpenSubscribeModal(plan, cycle, 'switch');
                    }}
                    className="py-3 px-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-main)] font-extrabold text-xs hover:bg-[var(--color-surface)] transition-all cursor-pointer text-center carved-btn"
                  >
                    Start Fresh / Replace
                  </button>
                </div>
              </div>
            ) : (
              /* Content for Plan Switch Mode */
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-2 text-xs text-neutral-700">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-purple-950 font-extrabold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-700" />
                      <span>New Target Plan:</span>
                    </span>
                    <span className="font-black text-purple-900 text-sm">
                      {planWarningModal.plan.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-200">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-neutral-500 font-bold block">Daily Protein:</span>
                      <span className="text-xs font-black text-emerald-700">{planWarningModal.plan.proteinPerDay}g / Day</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-neutral-500 font-bold block">Plan Price:</span>
                      <span className="text-xs font-black text-purple-950">
                        {formatCurrency(
                          planWarningModal.cycle === 'monthly'
                            ? planWarningModal.plan.monthlyPrice
                            : planWarningModal.cycle === 'tomorrow'
                            ? planWarningModal.plan.tomorrowPrice
                            : planWarningModal.plan.weeklyPrice
                        )}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-purple-900 font-medium pt-1">
                    🔄 Switching plans will automatically archive your previous subscription and activate your new {planWarningModal.plan.name} schedule.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const plan = planWarningModal.plan;
                      const cycle = planWarningModal.cycle;
                      setPlanWarningModal(null);
                      handleOpenSubscribeModal(plan, cycle, 'switch');
                    }}
                    className="flex-1 py-3.5 px-4 rounded-2xl bg-purple-700 hover:bg-purple-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Switch to {planWarningModal.plan.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlanWarningModal(null)}
                    className="py-3 px-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-extrabold text-xs hover:text-[var(--color-text-main)] transition-all cursor-pointer text-center"
                  >
                    Keep Current Plan
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 🚀 RESPONSIVE SUBSCRIPTION ACTIVATION POPUP MODAL (CONSTRAINED TO VIEWPORT, NO BASKET) */}
      {isActivationModalOpen && selectedPlanForActivation && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-fade-in carved-box">
            
            {/* 1. Modal Fixed Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-3 bg-[var(--color-surface)] shrink-0">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-black uppercase">
                  <Sparkles className="w-3 h-3" />
                  <span>VIP Plan Activation</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[var(--color-text-main)] tracking-tight">
                  {selectedPlanForActivation.name}
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)] font-medium">
                  {activationCycle === 'tomorrow'
                    ? `Single-Day Pre-Order for Tomorrow (${formattedTomorrow})`
                    : activationCycle === 'monthly'
                    ? '30-Day Monthly VIP Meal Schedule'
                    : '7-Day Weekly Flex Meal Schedule'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsActivationModalOpen(false);
                  setSelectedPlanForActivation(null);
                }}
                className="p-2 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Scrollable Body (Guaranteed to stay within Viewport) */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5 no-scrollbar">
              
              {/* Duration Switcher inside modal */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--color-primary)] block">
                  1. Plan Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActivationCycle('tomorrow')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activationCycle === 'tomorrow'
                        ? 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)] font-black border-transparent shadow-xs'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">Tomorrow</span>
                    <span className="text-[10px] opacity-80 block">{formatCurrency(selectedPlanForActivation.tomorrowPrice)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivationCycle('weekly')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activationCycle === 'weekly'
                        ? 'bg-[var(--color-primary)] text-white font-black border-transparent shadow-xs'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">7-Day Flex</span>
                    <span className="text-[10px] opacity-80 block">{formatCurrency(selectedPlanForActivation.weeklyPrice)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivationCycle('monthly')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activationCycle === 'monthly'
                        ? 'bg-[var(--color-primary)] text-white font-black border-transparent shadow-xs'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                    }`}
                  >
                    <span className="text-xs font-extrabold block">30-Day VIP</span>
                    <span className="text-[10px] opacity-80 block">{formatCurrency(selectedPlanForActivation.monthlyPrice)}</span>
                  </button>
                </div>
              </div>

              {/* Fitness Goal Picker */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--color-primary)] block">
                  2. Select Primary Fitness Goal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FITNESS_GOALS.map((g) => {
                    const Icon = g.icon;
                    const isSelected = activationGoalId === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setActivationGoalId(g.id)}
                        className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 carved-btn ${
                          isSelected
                            ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary-muted)]'
                            : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-[var(--color-primary)]'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-black text-[var(--color-text-main)] block truncate">
                            {g.label}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)] font-medium block truncate">
                            {g.badge}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dietary & Dispatch Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)] block">
                    Dietary Focus
                  </label>
                  <select
                    value={activationDiet}
                    onChange={(e) => setActivationDiet(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  >
                    <option value="High Protein">High Protein</option>
                    <option value="Keto / Low Carb">Keto / Low Carb</option>
                    <option value="Pure Vegan">Pure Vegan</option>
                    <option value="Balanced Fit">Balanced Fit</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-muted)] block">
                    Delivery Slot
                  </label>
                  <select
                    value={activationSlot}
                    onChange={(e) => setActivationSlot(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  >
                    <option value="Lunch & Dinner (12 PM & 7 PM)">Lunch & Dinner (12 PM & 7 PM)</option>
                    <option value="Morning & Evening (8 AM & 6 PM)">Morning & Evening (8 AM & 6 PM)</option>
                    <option value="All-Day 3-Meal Dispatch (8 AM, 1 PM, 7 PM)">All-Day 3-Meal Dispatch</option>
                  </select>
                </div>
              </div>

              {/* Customer Contact & Delivery Address Form */}
              <div className="bg-[var(--color-surface-hover)] rounded-2xl p-4 border border-[var(--color-border)] space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>3. Delivery & Contact Details</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1">
                    Complete Delivery Address *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    placeholder="Flat / Building, Street, Area, Bengaluru - 560001"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Order Summary & Price Breakdown */}
              <div className="bg-purple-50/70 rounded-2xl p-4 border border-purple-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-600 font-semibold">
                  <span>Plan Amount ({activationCycle === 'tomorrow' ? 'Single-Day Pre-Order' : activationCycle === 'monthly' ? '30 Days' : '7 Days'}):</span>
                  <span className="font-bold text-neutral-900">
                    {formatCurrency(activationCycle === 'tomorrow' ? selectedPlanForActivation.tomorrowPrice : activationCycle === 'monthly' ? selectedPlanForActivation.monthlyPrice : selectedPlanForActivation.weeklyPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-600 font-semibold">
                  <span>VIP Pre-Order Delivery:</span>
                  <span className="font-bold text-emerald-700 uppercase">FREE (₹0)</span>
                </div>
                <div className="flex items-center justify-between text-neutral-600 font-semibold">
                  <span>GST & Kitchen Packaging:</span>
                  <span className="font-bold text-neutral-900">Included</span>
                </div>
                <div className="flex items-center justify-between text-sm font-black text-purple-950 pt-2 border-t border-purple-200">
                  <span>Total Amount Payable:</span>
                  <span className="text-base font-black text-purple-950">
                    {formatCurrency(activationCycle === 'tomorrow' ? selectedPlanForActivation.tomorrowPrice : activationCycle === 'monthly' ? selectedPlanForActivation.monthlyPrice : selectedPlanForActivation.weeklyPrice)}
                  </span>
                </div>
              </div>

            </div>

            {/* 3. Sticky Bottom Action Footer */}
            <div className="p-4 sm:p-5 bg-[var(--color-surface-hover)] border-t border-[var(--color-border)] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsActivationModalOpen(false);
                  setSelectedPlanForActivation(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isActivating}
                onClick={handleConfirmAndActivate}
                className="py-3 px-6 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn disabled:opacity-60"
              >
                {isActivating ? (
                  <span>Activating Subscription…</span>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Confirm & Activate Subscription</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Full Live Menu Picker Modal */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-7 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl relative space-y-4 animate-fade-in carved-box">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-[var(--color-text-main)] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
                  <span>Choose Tomorrow's Meal from Full Menu</span>
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                  Select any chef-crafted dish from Brokole's full menu for next-day dispatch.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="p-2 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search menu dishes by name, tag, or ingredient..."
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* Menu Dish Grid */}
            <div className="overflow-y-auto no-scrollbar flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pr-1">
              {storeProducts
                .filter((p) =>
                  !menuSearchQuery ||
                  p.title.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                  p.tags.some((t) => t.toLowerCase().includes(menuSearchQuery.toLowerCase()))
                )
                .map((product) => {
                  const price = parseFloat(product.priceRange.minVariantPrice.amount);
                  const isSelected = selectedTomorrowMeal.id === product.id;

                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedTomorrowMeal({
                          id: product.id,
                          name: product.title,
                          price,
                          protein: product.nutrition.protein,
                          calories: product.nutrition.calories,
                          image: product.featuredImage.url,
                        });
                        setIsMenuModalOpen(false);
                        toast.success(`Selected "${product.title}" for Tomorrow!`, {
                          description: `${product.nutrition.protein}g Protein • ${formatCurrency(price)}`,
                        });
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between carved-btn ${
                        isSelected
                          ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] ring-2 ring-[var(--color-accent-glow)] shadow-xs'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                      }`}
                    >
                      <div className="space-y-2">
                        <img
                          src={product.featuredImage.url}
                          alt={product.title}
                          className="w-full h-24 rounded-xl object-cover border border-[var(--color-border)] shadow-xs"
                        />
                        <div>
                          <h4 className="text-xs font-extrabold text-[var(--color-text-main)] line-clamp-2 leading-snug">
                            {product.title}
                          </h4>
                          <span className="text-[10px] text-[var(--color-primary)] font-bold block mt-1">
                            🔥 {product.nutrition.protein}g Protein · {product.nutrition.calories} kcal
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-[var(--color-border)] mt-2">
                        <span className="text-xs font-black text-[var(--color-text-main)]">{formatCurrency(price)}</span>
                        {isSelected ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[var(--color-accent)] text-[var(--color-text-on-accent)]">
                            SELECTED
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-md">
                            Select Dish
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
