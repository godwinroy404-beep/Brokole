import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { fetchProducts, Product } from '../lib/shopify';
import { useProductStore } from '../store/useProductStore';
import { MacroCalculator } from '../components/MacroCalculator';
import { CartMacroProgress } from '../components/CartMacroProgress';
import { ProductCard } from '../components/ProductCard';
import { useMacroStore } from '../store/useMacroStore';
import { Sparkles, Utensils, Target, Flame, Dumbbell, ShieldCheck, Zap } from 'lucide-react';

export const Route = createFileRoute('/my-macros')({
  loader: async () => {
    const products = await fetchProducts();
    return { products };
  },
  head: () => ({
    meta: [
      { title: 'My Macros & Calorie Tracker — Bro-Ko-Le' },
      { name: 'description', content: 'Calculate your daily target calories, protein, carbs, and fats using the Mifflin-St Jeor formula and find matching meals.' },
    ],
  }),
  component: MyMacrosPage,
});

function MyMacrosPage() {
  const { products: initialProducts } = Route.useLoaderData();
  const storeProducts = useProductStore((state) => state.products);
  const { calculated, profile } = useMacroStore();

  const allProducts = storeProducts && storeProducts.length > 0 ? storeProducts : initialProducts;

  // Target per-meal calorie budget (assuming 3 main meals daily)
  const targetMealCal = Math.round((calculated.targetCalories || 2000) / 3);

  // Goal-based metadata and filtering rules
  const getGoalInfo = () => {
    switch (profile.goal) {
      case 'weight_loss':
        return {
          title: `Weight Loss & Fat Burn Meals (~${targetMealCal} kcal/meal)`,
          desc: `Calorie-controlled, high-fiber & protein-dense meals designed to accelerate fat loss while achieving your ${calculated.targetProtein}g daily protein target.`,
          badge: '🔥 Fat Loss Match',
          filterFn: (p: Product) => p.nutrition.calories <= 440 && p.nutrition.protein >= 20,
        };
      case 'muscle_gain':
        return {
          title: `Muscle Building & Bulk Meals (~${targetMealCal} kcal/meal)`,
          desc: `High protein (26g+) and nutrient-dense meals optimized for hypertrophy, muscle recovery, and meeting your ${calculated.targetProtein}g daily protein target.`,
          badge: '💪 Hypertrophy Match',
          filterFn: (p: Product) => p.nutrition.protein >= 26,
        };
      case 'maintenance':
      default:
        return {
          title: `Macro-Balanced Fitness Meals (~${targetMealCal} kcal/meal)`,
          desc: `Balanced protein, carb, and healthy fat meals engineered to sustain energy, recovery, and maintain lean body mass.`,
          badge: '⚖️ Fitness Match',
          filterFn: (p: Product) => p.nutrition.protein >= 20,
        };
    }
  };

  const goalInfo = getGoalInfo();

  // Filter and sort products according to goal match and proximity to target meal calories
  const recommendedMeals = React.useMemo(() => {
    let list = allProducts.filter(goalInfo.filterFn);
    if (list.length === 0) list = allProducts; // fallback if restrictive

    // Sort by calorie proximity to targetMealCal
    return [...list].sort((a, b) => {
      const diffA = Math.abs(a.nutrition.calories - targetMealCal);
      const diffB = Math.abs(b.nutrition.calories - targetMealCal);
      return diffA - diffB;
    });
  }, [allProducts, goalInfo, targetMealCal]);

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-4">
      {/* Interactive Calculator */}
      <MacroCalculator />

      {/* Cart Macro Progress Bar */}
      <CartMacroProgress />

      {/* Goal Summary Banner */}
      <div className="p-4 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex flex-wrap items-center justify-between gap-4 carved-box">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
              Active Strategy
            </span>
            <h3 className="text-base font-black text-[var(--color-text-main)] capitalize">
              {profile.goal.replace('_', ' ')} • {calculated.targetCalories} kcal / day
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-extrabold">
          <div className="px-3 py-1.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-main)]">
            🎯 Per-Meal Budget: <span className="text-[var(--color-primary)] font-black">~{targetMealCal} kcal</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[var(--color-accent-light)] text-[var(--color-text-on-accent)]">
            🔥 Daily Protein: <span className="font-black">{calculated.targetProtein}g</span>
          </div>
        </div>
      </div>

      {/* Recommended Meals for Goal */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight flex items-center gap-2">
              <span>{goalInfo.title}</span>
              <Sparkles className="w-5 h-5 text-[var(--color-accent)] fill-[var(--color-accent)] animate-pulse" />
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-medium max-w-2xl mt-0.5">
              {goalInfo.desc}
            </p>
          </div>

          <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black shrink-0">
            {goalInfo.badge}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {recommendedMeals.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
