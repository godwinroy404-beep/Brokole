import React, { useState, useRef, useEffect } from 'react';
import { useMacroStore } from '../store/useMacroStore';
import { Activity, Dumbbell, Flame, Scale, Sparkles, Target, ShieldCheck, ChevronDown, Check } from 'lucide-react';

const ACTIVITY_OPTIONS = [
  { id: 'sedentary', label: 'Sedentary (Desk Job)' },
  { id: 'moderate', label: 'Moderately Active (3-4 workouts/wk)' },
  { id: 'active', label: 'Active (5+ workouts/wk)' },
  { id: 'very_active', label: 'Very Active (Athlete/Physical Job)' },
];

export const MacroCalculator: React.FC = () => {
  const { profile, calculated, setProfile, isGoalSet, setAsGoal } = useMacroStore();
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (activityRef.current && !activityRef.current.contains(event.target as Node)) {
        setIsActivityOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-7 shadow-card my-6 carved-box">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
            <span>My Macro Target Calculator</span>
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] font-medium">
            Custom nutrition recommendation powered by scientific BMR formulas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Form Inputs */}
        <div className="space-y-4">
          
          {/* Goal Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Primary Fitness Goal
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'weight_loss', label: 'Fat Loss', icon: Scale },
                { id: 'muscle_gain', label: 'Build Muscle', icon: Dumbbell },
                { id: 'maintenance', label: 'Maintain', icon: Target },
              ].map((g) => {
                const Icon = g.icon;
                const isSelected = profile.goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setProfile({ goal: g.id as any })}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer carved-btn ${
                      isSelected
                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] shadow-xs scale-[1.02]'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-[var(--color-accent)]' : ''}`} />
                    <span>{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weight & Height */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                value={profile.weightKg}
                onChange={(e) => setProfile({ weightKg: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Height (cm)
              </label>
              <input
                type="number"
                value={profile.heightCm}
                onChange={(e) => setProfile({ heightCm: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>
          </div>

          {/* Age & Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Age (years)
              </label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile({ age: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Gender
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProfile({ gender: 'male' })}
                  className={`py-2 px-3 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer carved-btn ${
                    profile.gender === 'male'
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] shadow-xs'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setProfile({ gender: 'female' })}
                  className={`py-2 px-3 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer carved-btn ${
                    profile.gender === 'female'
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] shadow-xs'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                  }`}
                >
                  Female
                </button>
              </div>
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Daily Activity Level
            </label>
            <div className="relative" ref={activityRef}>
              <button
                type="button"
                onClick={() => setIsActivityOpen(!isActivityOpen)}
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-primary-muted)] rounded-2xl text-xs font-extrabold text-[var(--color-text-main)] flex items-center justify-between gap-2 shadow-xs transition-all cursor-pointer carved-btn"
              >
                <span className="truncate">{ACTIVITY_OPTIONS.find((a) => a.id === profile.activityLevel)?.label || 'Select Activity'}</span>
                <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] shrink-0 transition-transform duration-200 ${isActivityOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
              </button>

              {isActivityOpen && (
                <div className="absolute left-0 top-full mt-2 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 carved-box">
                  {ACTIVITY_OPTIONS.map((opt) => {
                    const isSelected = profile.activityLevel === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setProfile({ activityLevel: opt.id as any });
                          setIsActivityOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-extrabold'
                            : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Calculated Results Card */}
        <div className="bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-3xl p-6 flex flex-col justify-between shadow-card relative overflow-hidden carved-box">
          
          <div className="relative z-10">
            <span className="text-xs uppercase font-black text-[var(--color-accent)] tracking-wider">
              Recommended Daily Target
            </span>

            {/* Target Calories */}
            <div className="my-4">
              <span className="text-4xl font-black tracking-tight text-white flex items-center gap-2">
                <Flame className="w-8 h-8 text-[var(--color-accent)] fill-[var(--color-accent)]" />
                {calculated.targetCalories}
                <span className="text-sm font-bold text-emerald-200">kcal/day</span>
              </span>
            </div>

            {/* Macro Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 mt-4 text-center">
              
              <div className="bg-black/25 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10">
                <span className="block text-xl font-black text-[var(--color-accent)]">{calculated.targetProtein}g</span>
                <span className="text-[10px] text-emerald-200 uppercase font-bold">Protein</span>
              </div>

              <div className="bg-black/25 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10">
                <span className="block text-xl font-black text-amber-300">{calculated.targetCarbs}g</span>
                <span className="text-[10px] text-emerald-200 uppercase font-bold">Carbs</span>
              </div>

              <div className="bg-black/25 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10">
                <span className="block text-xl font-black text-orange-300">{calculated.targetFat}g</span>
                <span className="text-[10px] text-emerald-200 uppercase font-bold">Fat</span>
              </div>

            </div>
          </div>

          {/* Quick Tip */}
          <div className="mt-6 pt-4 border-t border-white/10 text-xs text-emerald-100 flex items-center gap-2 font-medium">
            <span>Ordering 2 meals from Brokole covers ~70% of your daily protein target!</span>
          </div>

          {/* Set Goal Button */}
          <div className="mt-6">
            {!isGoalSet ? (
              <button
                onClick={setAsGoal}
                className="w-full py-3 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-black text-sm uppercase tracking-wider rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 carved-btn"
              >
                <Target className="w-4 h-4" />
                Set As My Daily Goal
              </button>
            ) : (
              <div className="w-full py-3 px-4 bg-emerald-500/20 text-emerald-100 font-black text-sm uppercase tracking-wider rounded-2xl border border-emerald-500/30 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Goal Active
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
