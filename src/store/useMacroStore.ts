import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserMacroProfile {
  weightKg: number | '';
  heightCm: number | '';
  age: number | '';
  gender: 'male' | 'female';
  activityLevel: 'sedentary' | 'moderate' | 'active' | 'very_active';
  goal: 'weight_loss' | 'muscle_gain' | 'maintenance';
}

export interface CalculatedMacros {
  targetCalories: number;
  targetProtein: number; // g
  targetCarbs: number; // g
  targetFat: number; // g
}

interface MacroState {
  profile: UserMacroProfile;
  calculated: CalculatedMacros;
  setProfile: (profile: Partial<UserMacroProfile>) => void;
  calculate: () => void;
  isGoalSet: boolean;
  setAsGoal: () => void;
}

const DEFAULT_PROFILE: UserMacroProfile = {
  weightKg: 70,
  heightCm: 175,
  age: 26,
  gender: 'male',
  activityLevel: 'moderate',
  goal: 'muscle_gain',
};

function computeMacros(profile: UserMacroProfile): CalculatedMacros {
  const weightKg = Number(profile.weightKg) || 0;
  const heightCm = Number(profile.heightCm) || 0;
  const age = Number(profile.age) || 0;
  const { gender, activityLevel, goal } = profile;

  // Mifflin-St Jeor Equation for BMR
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  bmr = gender === 'male' ? bmr + 5 : bmr - 161;

  // Activity Multipliers
  const multipliers = {
    sedentary: 1.2,
    moderate: 1.45,
    active: 1.65,
    very_active: 1.85,
  };

  let tdee = bmr * (multipliers[activityLevel] || 1.45);

  if (goal === 'weight_loss') {
    tdee -= 400;
  } else if (goal === 'muscle_gain') {
    tdee += 350;
  }

  const targetCalories = Math.round(tdee);

  // Protein calculation (approx 2g per kg bodyweight for active/muscle gain)
  const targetProtein = Math.round(weightKg * (goal === 'muscle_gain' ? 2.2 : 1.8));

  // Fat calculation (25% of calories)
  const fatCalories = targetCalories * 0.25;
  const targetFat = Math.round(fatCalories / 9);

  // Carbs calculation (remaining calories)
  const proteinCalories = targetProtein * 4;
  const carbCalories = Math.max(0, targetCalories - (proteinCalories + fatCalories));
  const targetCarbs = Math.round(carbCalories / 4);

  return {
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
  };
}

export const useMacroStore = create<MacroState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      calculated: computeMacros(DEFAULT_PROFILE),

      setProfile: (newProfile) => {
        const updated = { ...get().profile, ...newProfile };
        set({
          profile: updated,
          calculated: computeMacros(updated),
          isGoalSet: false, // Reset goal status when profile changes
        });
      },

      calculate: () => {
        set({ calculated: computeMacros(get().profile) });
      },

      isGoalSet: false,
      setAsGoal: () => set({ isGoalSet: true }),
    }),
    {
      name: 'brokole-macro-profile',
    }
  )
);
