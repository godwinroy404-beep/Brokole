import React from 'react';
import { useCartStore } from '../store/useCartStore';
import { useMacroStore } from '../store/useMacroStore';
import { Flame, Activity, Zap } from 'lucide-react';

export const CartMacroProgress: React.FC = () => {
  const { isGoalSet, calculated } = useMacroStore();
  const items = useCartStore((state) => state.items); // Subscribe to items to trigger re-renders
  const getMacroTotals = useCartStore((state) => state.getMacroTotals);
  const cartTotals = getMacroTotals();
  const cartItemsCount = useCartStore((state) => state.getTotalItems());

  if (!isGoalSet) return null;

  const getPercentage = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const calPct = getPercentage(cartTotals.calories, calculated.targetCalories);
  const proPct = getPercentage(cartTotals.protein, calculated.targetProtein);
  const carbPct = getPercentage(cartTotals.carbs, calculated.targetCarbs);
  const fatPct = getPercentage(cartTotals.fat, calculated.targetFat);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 shadow-card carved-box relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black text-[var(--color-text-main)] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--color-primary)]" />
            Cart vs Daily Goal
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] font-bold mt-1">
            {cartItemsCount} {cartItemsCount === 1 ? 'item' : 'items'} in cart
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-black">
          <Flame className="w-4 h-4 text-orange-500 inline mr-1" />
          {cartTotals.calories} / {calculated.targetCalories} kcal
        </div>
      </div>

      <div className="space-y-4">
        {/* Calories Progress */}
        <div>
          <div className="flex justify-between text-xs font-bold mb-1.5">
            <span className="text-[var(--color-text-main)]">Calories</span>
            <span className="text-[var(--color-text-muted)]">{calPct}%</span>
          </div>
          <div className="h-2.5 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-orange-400 rounded-full transition-all duration-500"
              style={{ width: `${calPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          {/* Protein */}
          <div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider font-black mb-1.5">
              <span className="text-[var(--color-text-main)]">Protein</span>
              <span className="text-[var(--color-text-muted)]">
                {cartTotals.protein}/{calculated.targetProtein}g
              </span>
            </div>
            <div className="h-2 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                style={{ width: `${proPct}%` }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider font-black mb-1.5">
              <span className="text-[var(--color-text-main)]">Carbs</span>
              <span className="text-[var(--color-text-muted)]">
                {cartTotals.carbs}/{calculated.targetCarbs}g
              </span>
            </div>
            <div className="h-2 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${carbPct}%` }}
              />
            </div>
          </div>

          {/* Fat */}
          <div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider font-black mb-1.5">
              <span className="text-[var(--color-text-main)]">Fat</span>
              <span className="text-[var(--color-text-muted)]">
                {cartTotals.fat}/{calculated.targetFat}g
              </span>
            </div>
            <div className="h-2 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-red-400 rounded-full transition-all duration-500"
                style={{ width: `${fatPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
