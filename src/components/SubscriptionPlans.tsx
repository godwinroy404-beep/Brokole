import React, { useState, useEffect } from 'react';
import { useCartStore } from '../store/useCartStore';
import { useMacroStore } from '../store/useMacroStore';
import { useProductStore } from '../store/useProductStore';
import { Product } from '../lib/shopify';
import { formatCurrency } from '../lib/nutritionParser';
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
    badge: 'Peak Performance',
    icon: Zap,
    desc: 'Clean complex carbs & protein fueling intense workouts, stamina & endurance.',
    dietMatch: 'High Protein',
  },
];

const SUBSCRIPTION_PLANS: PlanTier[] = [
  {
    id: 'plan-weekly-flex',
    name: 'Weekly Flex Plan',
    tagline: 'Ideal for trying out macro-balanced eating with complete flexibility.',
    tomorrowPrice: 299,
    weeklyPrice: 1899,
    monthlyPrice: 5999,
    mealsPerDay: 2,
    proteinPerDay: 75,
    features: [
      '2 Chef & Dietitian meals daily (Lunch + Dinner)',
      'Free pre-order delivery to your door',
      'Pause, skip, or modify meals anytime via app',
      'Macro breakdown report included per delivery',
    ],
  },
  {
    id: 'plan-shred-gain',
    name: 'Shred & Gain Pro',
    tagline: 'Our #1 most popular plan for rapid fitness transformation and muscle gain.',
    tomorrowPrice: 399,
    weeklyPrice: 2399,
    monthlyPrice: 7499,
    mealsPerDay: 2,
    proteinPerDay: 95,
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
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const setMacroProfile = useMacroStore((state) => state.setProfile);
  const macroProfile = useMacroStore((state) => state.profile);

  const storeProducts = useProductStore((state) => state.products);
  const loadProducts = useProductStore((state) => state.loadProducts);

  const [billingCycle, setBillingCycle] = useState<'tomorrow' | 'weekly' | 'monthly'>('tomorrow');
  const [selectedDiet, setSelectedDiet] = useState<string>('High Protein');
  const [selectedSlot, setSelectedSlot] = useState<string>('Lunch & Dinner (12 PM & 7 PM)');

  // Full Menu Picker State
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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
    image: '/images/hero_bowl.png',
  });

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

  const handleBookForTomorrow = () => {
    if (!selectedTomorrowMeal.name || selectedTomorrowMeal.price === 0) {
      toast.error('Please select a meal for tomorrow first!');
      return;
    }
    const preOrderProduct: Product = {
      id: `preorder-${selectedTomorrowMeal.id}-${Date.now()}`,
      handle: `preorder-${selectedTomorrowMeal.id}`,
      title: `${selectedTomorrowMeal.name} (Pre-Booked for Tomorrow)`,
      productType: 'Pre-Order Delivery',
      tags: ['Pre-Order', 'Tomorrow Delivery', tomorrowSlot],
      description: `Scheduled Dispatch: Tomorrow (${formattedTomorrow}) during ${tomorrowSlot}\nProtein: ${selectedTomorrowMeal.protein}g | Calories: ${selectedTomorrowMeal.calories} kcal`,
      featuredImage: { url: selectedTomorrowMeal.image, altText: selectedTomorrowMeal.name },
      images: [{ url: selectedTomorrowMeal.image, altText: selectedTomorrowMeal.name }],
      priceRange: { minVariantPrice: { amount: selectedTomorrowMeal.price.toString(), currencyCode: 'INR' } },
      variants: [{ id: `var-${Date.now()}`, title: `Tomorrow (${tomorrowSlot})`, price: { amount: selectedTomorrowMeal.price.toString(), currencyCode: 'INR' }, availableForSale: true }],
      nutrition: { protein: selectedTomorrowMeal.protein, calories: selectedTomorrowMeal.calories, carbs: 45, fat: 14, fiber: 8 },
      prepTime: `Tomorrow (${tomorrowSlot})`,
    };

    addItem(preOrderProduct);
    toast.success(`Pre-Booked for Tomorrow (${formattedTomorrow})! 🎉`, {
      description: `${selectedTomorrowMeal.name} reserved for ${tomorrowSlot} dispatch`,
    });
    openCart();
  };

  // Modal State for asking Goal upon clicking Subscribe
  const [pendingPlan, setPendingPlan] = useState<PlanTier | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('weight_loss');

  const handleSubscribe = (plan: PlanTier) => {
    // Determine default pre-selected goal based on macro profile or plan
    const initialGoal = macroProfile.goal || (plan.id === 'plan-shred-gain' ? 'muscle_gain' : 'weight_loss');
    setSelectedGoalId(initialGoal);
    setPendingPlan(plan);
    setIsGoalModalOpen(true);
  };

  const confirmSubscriptionWithGoal = (goalObj?: FitnessGoalOption) => {
    if (!pendingPlan) return;
    const plan = pendingPlan;
    const goal = goalObj || FITNESS_GOALS.find((g) => g.id === selectedGoalId) || FITNESS_GOALS[0];

    // Sync user macro profile
    setMacroProfile({ goal: goal.id as any });

    const isTomorrow = billingCycle === 'tomorrow';
    const isMonthly = billingCycle === 'monthly';
    const price = isTomorrow ? plan.tomorrowPrice : (isMonthly ? plan.monthlyPrice : plan.weeklyPrice);
    const duration = isTomorrow ? `Single-Day Pre-Order (${formattedTomorrow})` : (isMonthly ? '30-Day Monthly' : '7-Day Weekly');

    const customSubscriptionProduct: Product = {
      id: `sub-${plan.id}-${billingCycle}-${goal.id}`,
      handle: `subscription-${plan.id}`,
      title: `Bro-Ko-Le ${plan.name} (${duration})`,
      productType: isTomorrow ? 'Pre-Order Delivery' : 'Meal Subscription',
      tags: [
        isTomorrow ? 'Pre-Order' : 'Subscription',
        'Meal Plan',
        plan.name,
        selectedDiet,
        goal.label,
        ...(isTomorrow ? ['Tomorrow Delivery', formattedTomorrow] : []),
      ],
      description: `${plan.name} (${duration})\n\nPrimary Fitness Goal: ${goal.label} (${goal.badge})\nDietary Focus: ${selectedDiet}\nDelivery Window: ${selectedSlot}\nDaily Protein Target: ${plan.proteinPerDay}g/day\n\nFeatures:\n` + plan.features.join('\n'),
      featuredImage: {
        url: '/images/grilled_chicken_bowl.png',
        altText: plan.name,
      },
      images: [{ url: '/images/grilled_chicken_bowl.png', altText: plan.name }],
      priceRange: {
        minVariantPrice: {
          amount: price.toString(),
          currencyCode: 'INR',
        },
      },
      variants: [
        {
          id: `variant-sub-${plan.id}-${goal.id}`,
          title: `${duration} Plan (${goal.label})`,
          price: { amount: price.toString(), currencyCode: 'INR' },
          availableForSale: true,
        },
      ],
      nutrition: {
        calories: plan.mealsPerDay * 450,
        protein: plan.proteinPerDay,
        carbs: plan.mealsPerDay * 35,
        fat: plan.mealsPerDay * 12,
        fiber: plan.mealsPerDay * 6,
      },
      prepTime: isTomorrow ? `Tomorrow Dispatch (${formattedTomorrow})` : 'Daily Fresh Delivery',
    };

    addItem(customSubscriptionProduct);
    toast.success(isTomorrow ? `Pre-Booked for Tomorrow! 🎉` : `Subscribed to ${plan.name}! 🎉`, {
      description: `Goal: ${goal.label} • ${duration} Plan (${formatCurrency(price)}) added to cart`,
    });

    setIsGoalModalOpen(false);
    setPendingPlan(null);
    openCart();
  };

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-3xl p-6 sm:p-10 shadow-card relative overflow-hidden carved-box">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-[var(--color-primary-muted)] opacity-30 blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-[var(--color-primary-muted)] text-[var(--color-accent)] text-xs font-black mb-3 border border-[var(--color-accent-glow)]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Bro-Ko-Le Subscription Studio</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Put Your Nutrition on Autopilot <br className="hidden sm:inline" />
            <span className="text-[var(--color-accent)]">Save Up to 25% Every Month</span>
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-2 leading-relaxed max-w-xl">
            Fresh chef-prepared, dietitian-formulated meals delivered directly to your doorstep with pre-order dispatch. Pause, swap meals, or cancel anytime with 1 click.
          </p>
        </div>
      </div>

      {/* 🚀 BOOK FOR TOMORROW PRE-ORDER SECTION */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 shadow-card relative overflow-hidden space-y-6 carved-box">
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
              
              {/* Compact Menu Select */}
              <div className="relative w-full sm:w-64 shrink-0">
                <select
                  value={selectedTomorrowMeal.id}
                  onChange={(e) => {
                    const found = storeProducts.find((p) => p.id === e.target.value);
                    if (found) {
                      const mealPrice = parseFloat(found.priceRange.minVariantPrice.amount);
                      setSelectedTomorrowMeal({
                        id: found.id,
                        name: found.title,
                        price: mealPrice,
                        protein: found.nutrition.protein,
                        calories: found.nutrition.calories,
                        image: found.featuredImage.url,
                      });
                      toast.success(`Selected "${found.title}" for Tomorrow!`, {
                        description: `${found.nutrition.protein}g Protein • ${formatCurrency(mealPrice)}`,
                      });
                    }
                  }}
                  className="w-full py-2.5 px-3 pr-8 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-extrabold text-[var(--color-text-main)] appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] shadow-xs truncate"
                >
                  <option value="" disabled>-- Select Meal --</option>
                  {storeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} • {formatCurrency(parseFloat(p.priceRange.minVariantPrice.amount))} ({p.nutrition.protein}g P)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleBookForTomorrow}
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

              {/* Action Button */}
              <div className="pt-6 border-t border-[var(--color-border-subtle)] mt-6">
                <button
                  onClick={() => handleSubscribe(plan)}
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

      {/* Fitness Goal Selection Modal */}
      {isGoalModalOpen && pendingPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-6 animate-fade-in carved-box">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black uppercase mb-1">
                  <Target className="w-3.5 h-3.5" />
                  <span>Tailor Your Plan Goal</span>
                </div>
                <h3 className="text-xl font-black text-[var(--color-text-main)] tracking-tight">
                  What is your primary fitness goal?
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1">
                  We'll customize your <strong className="text-[var(--color-primary)] font-bold">{pendingPlan.name}</strong> meal portions and macro distribution to match your exact target.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsGoalModalOpen(false);
                  setPendingPlan(null);
                }}
                className="p-2 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Goal Choice Options */}
            <div className="space-y-3">
              {FITNESS_GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoalId === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => confirmSubscriptionWithGoal(goal)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 carved-btn ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary-muted)]'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-border)]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-sm text-[var(--color-text-main)] truncate">
                          {goal.label}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/80 border border-neutral-200 text-neutral-800 shrink-0">
                          {goal.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1 leading-relaxed">
                        {goal.desc}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0 font-bold text-xs mt-1">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsGoalModalOpen(false);
                  setPendingPlan(null);
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => confirmSubscriptionWithGoal()}
                className="w-full sm:w-1/2 py-3.5 px-5 rounded-2xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
              >
                <span>Confirm Goal & Subscribe</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Full Live Menu Picker Modal */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl relative space-y-4 animate-fade-in carved-box">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-[var(--color-text-main)] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
                  <span>Choose Tomorrow's Meal from Full Menu</span>
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                  Select any chef-crafted dish from Bro-Ko-Le's full menu for next-day dispatch.
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
