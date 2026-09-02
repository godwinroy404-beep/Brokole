import React from 'react';
import { NutritionInfo } from '../lib/nutritionParser';
import { Flame, PieChart, ShieldCheck } from 'lucide-react';

interface NutritionLabelProps {
  nutrition: NutritionInfo;
  portionName?: string;
}

export const NutritionLabel: React.FC<NutritionLabelProps> = ({ nutrition, portionName = '1 Serving (350g)' }) => {
  // % Daily values based on 2000 kcal diet
  const dvProtein = Math.round((nutrition.protein / 50) * 100);
  const dvCarbs = Math.round((nutrition.carbs / 275) * 100);
  const dvFat = Math.round((nutrition.fat / 78) * 100);
  const dvFiber = Math.round((nutrition.fiber / 28) * 100);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card max-w-md w-full carved-box">
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-[var(--color-text-main)] pb-3 mb-3">
        <div>
          <h4 className="text-xl font-black uppercase tracking-tight text-[var(--color-text-main)]">Nutrition Facts</h4>
          <p className="text-xs text-[var(--color-text-muted)] font-semibold">Serving Size: {portionName}</p>
        </div>
        <div className="p-2.5 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          <PieChart className="w-6 h-6" />
        </div>
      </div>

      {/* Calories Block */}
      <div className="flex items-center justify-between border-b-8 border-[var(--color-text-main)] py-3 mb-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Amount Per Serving</span>
          <div className="text-3xl font-black tracking-tight text-[var(--color-text-main)] flex items-center gap-1.5">
            <Flame className="w-6 h-6 text-[var(--color-deal)] fill-[var(--color-deal)]" />
            <span>{nutrition.calories}</span>
            <span className="text-sm font-bold text-[var(--color-text-muted)]">kcal</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-[var(--color-primary)] px-3 py-1.5 rounded-2xl bg-[var(--color-primary-light)] border border-[var(--color-border)] inline-block">
            Verified Formula
          </span>
        </div>
      </div>

      {/* % Daily Value Header */}
      <div className="text-right text-[11px] font-black border-b border-[var(--color-border)] pb-1 mb-2 text-[var(--color-text-muted)] uppercase">
        % Daily Value*
      </div>

      {/* Macro List */}
      <div className="space-y-2.5 text-xs text-[var(--color-text-main)]">
        
        {/* Protein */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] inline-block" />
            <span className="font-black text-sm">Protein</span>
            <span className="font-extrabold text-[var(--color-primary)]">{nutrition.protein}g</span>
          </div>
          <span className="font-black">{dvProtein}%</span>
        </div>

        {/* Total Carbs */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-deal)] inline-block" />
            <span className="font-bold">Total Carbohydrates</span>
            <span className="font-semibold text-[var(--color-text-muted)]">{nutrition.carbs}g</span>
          </div>
          <span className="font-black">{dvCarbs}%</span>
        </div>

        {/* Dietary Fiber */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2 pl-5 text-[var(--color-text-muted)]">
          <span>Dietary Fiber {nutrition.fiber}g</span>
          <span className="font-bold">{dvFiber}%</span>
        </div>

        {/* Total Fat */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="font-bold">Total Fat</span>
            <span className="font-semibold text-[var(--color-text-muted)]">{nutrition.fat}g</span>
          </div>
          <span className="font-black">{dvFat}%</span>
        </div>

      </div>

      {/* Footer Note */}
      <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-light)] flex items-center justify-between">
        <span>*Percent Daily Values are based on a 2,000 calorie diet.</span>
        <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
      </div>
    </div>
  );
};
