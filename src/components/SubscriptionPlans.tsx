import React, { useState } from 'react';
import { useCartStore } from '../store/useCartStore';
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
} from 'lucide-react';
import { toast } from 'sonner';

export interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  weeklyPrice: number;
  monthlyPrice: number;
  mealsPerDay: number;
  proteinPerDay: number;
  popular?: boolean;
  features: string[];
  badge?: string;
}

const SUBSCRIPTION_PLANS: PlanTier[] = [
  {
    id: 'plan-weekly-flex',
    name: 'Weekly Flex Plan',
    tagline: 'Ideal for trying out macro-balanced eating with complete flexibility.',
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

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedDiet, setSelectedDiet] = useState<string>('High Protein');
  const [selectedSlot, setSelectedSlot] = useState<string>('Lunch & Dinner (12 PM & 7 PM)');

  const handleSubscribe = (plan: PlanTier) => {
    const isMonthly = billingCycle === 'monthly';
    const price = isMonthly ? plan.monthlyPrice : plan.weeklyPrice;
    const duration = isMonthly ? '30-Day Monthly' : '7-Day Weekly';

    const customSubscriptionProduct: Product = {
      id: `sub-${plan.id}-${billingCycle}`,
      handle: `subscription-${plan.id}`,
      title: `Bro-Ko-Le ${plan.name} (${duration})`,
      productType: 'Meal Subscription',
      tags: ['Subscription', 'Meal Plan', plan.name, selectedDiet],
      description: `${plan.name} (${duration} Subscription)\n\nDietary Focus: ${selectedDiet}\nDelivery Window: ${selectedSlot}\nDaily Protein Target: ${plan.proteinPerDay}g/day\n\nFeatures:\n` + plan.features.join('\n'),
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
          id: `variant-sub-${plan.id}`,
          title: `${duration} Plan`,
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
      prepTime: 'Daily Fresh Delivery',
    };

    addItem(customSubscriptionProduct);
    toast.success(`Subscribed to ${plan.name}!`, {
      description: `${duration} Plan • ${formatCurrency(price)} added to cart`,
    });
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

      {/* Cycle Toggle & Customizers */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs carved-box space-y-6">
        
        {/* Billing Cycle Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-6">
          <div>
            <span className="text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider block mb-1">
              Select Subscription Duration
            </span>
            <h3 className="text-base font-extrabold text-[var(--color-text-main)]">
              {billingCycle === 'monthly' ? 'Monthly Plan (Save 25%)' : 'Weekly Flex Plan'}
            </h3>
          </div>

          <div className="flex items-center bg-[var(--color-surface-hover)] p-1.5 rounded-2xl border border-[var(--color-border)]">
            <button
              onClick={() => setBillingCycle('weekly')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                billingCycle === 'weekly'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              Weekly (7 Days)
            </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
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
          const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.weeklyPrice;
          const perMealPrice = Math.round(price / (billingCycle === 'monthly' ? plan.mealsPerDay * 30 : plan.mealsPerDay * 7));

          return (
            <div
              key={plan.id}
              className={`relative bg-[var(--color-surface)] border rounded-3xl p-6 sm:p-8 shadow-card flex flex-col justify-between transition-all carved-box ${
                plan.popular
                  ? 'border-2 border-[var(--color-primary)] shadow-lg ring-2 ring-[var(--color-accent-glow)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
              }`}
            >
              {/* Popular Badge */}
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[var(--color-accent)] text-[var(--color-text-on-accent)] px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md">
                  {plan.badge}
                </div>
              )}

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
                      / {billingCycle === 'monthly' ? 'month' : 'week'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-[var(--color-primary)]">
                    <span>Includes {plan.mealsPerDay} meals daily</span>
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
                    plan.popular
                      ? 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)]'
                      : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
                  }`}
                >
                  <span>Subscribe to {plan.name}</span>
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

    </div>
  );
};
