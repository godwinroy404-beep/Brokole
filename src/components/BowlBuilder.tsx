import React, { useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { Product } from '../lib/shopify';
import { formatCurrency } from '../lib/nutritionParser';
import {
  Flame,
  Plus,
  Check,
  Sparkles,
  ChefHat,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface IngredientOption {
  id: string;
  name: string;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: 'base' | 'protein' | 'veggies' | 'sauce' | 'toppings';
  tag?: string;
  imageUrl: string;
}

const BASES: IngredientOption[] = [
  { id: 'base-1', name: 'Fluffy Organic Quinoa', price: 40, calories: 140, protein: 5, carbs: 25, fat: 2, category: 'base', tag: 'High Fiber', imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80' },
  { id: 'base-2', name: 'Brown Jasmine Rice', price: 35, calories: 160, protein: 4, carbs: 34, fat: 1, category: 'base', imageUrl: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=200&q=80' },
  { id: 'base-3', name: 'Cauli-Rice (Keto)', price: 45, calories: 35, protein: 2, carbs: 5, fat: 0, category: 'base', tag: 'Low Carb', imageUrl: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=200&q=80' },
  { id: 'base-4', name: 'Mixed Baby Greens & Spinach', price: 35, calories: 25, protein: 2, carbs: 3, fat: 0, category: 'base', tag: 'Vegan', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80' },
];

const PROTEINS: IngredientOption[] = [
  { id: 'prot-1', name: 'Herb-Marinated Grilled Chicken', price: 75, calories: 220, protein: 42, carbs: 0, fat: 4, category: 'protein', tag: '42g Protein', imageUrl: '/images/grilled_chicken_bowl.png' },
  { id: 'prot-2', name: 'Tandoori Spiced Paneer Cubes', price: 65, calories: 260, protein: 26, carbs: 4, fat: 16, category: 'protein', tag: 'Vegetarian', imageUrl: '/images/paneer_tikka_salad.png' },
  { id: 'prot-3', name: 'Seared Norwegian Salmon Fillet', price: 85, calories: 240, protein: 34, carbs: 0, fat: 12, category: 'protein', tag: 'Omega-3', imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=200&q=80' },
  { id: 'prot-4', name: 'Crispy Air-Fried Tofu Cubes', price: 55, calories: 150, protein: 18, carbs: 3, fat: 8, category: 'protein', tag: 'Vegan', imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80' },
];

const VEGGIES: IngredientOption[] = [
  { id: 'veg-1', name: 'Steamed Broccoli Florets', price: 15, calories: 30, protein: 2, carbs: 5, fat: 0, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=200&q=80' },
  { id: 'veg-2', name: 'Roasted Sweet Potato Wedges', price: 20, calories: 90, protein: 1, carbs: 20, fat: 0, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=200&q=80' },
  { id: 'veg-3', name: 'Fresh Hass Avocado Slices', price: 25, calories: 120, protein: 1, carbs: 6, fat: 11, category: 'veggies', tag: 'Healthy Fats', imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=200&q=80' },
  { id: 'veg-4', name: 'Charred Sweet Corn & Black Beans', price: 15, calories: 60, protein: 3, carbs: 12, fat: 1, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=200&q=80' },
  { id: 'veg-5', name: 'Cherry Tomatoes & Cucumber', price: 12, calories: 20, protein: 1, carbs: 4, fat: 0, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb1b7a5?auto=format&fit=crop&w=200&q=80' },
  { id: 'veg-6', name: 'Edamame Beans', price: 20, calories: 70, protein: 6, carbs: 5, fat: 3, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=200&q=80' },
];

const SAUCES: IngredientOption[] = [
  { id: 'sauce-1', name: 'Lemon Tahini Cream', price: 12, calories: 50, protein: 2, carbs: 3, fat: 4, category: 'sauce', imageUrl: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=200&q=80' },
  { id: 'sauce-2', name: 'Mint Yogurt Herb Dressing', price: 10, calories: 35, protein: 2, carbs: 2, fat: 2, category: 'sauce', imageUrl: 'https://images.unsplash.com/photo-1571217698542-a7d036136be9?auto=format&fit=crop&w=200&q=80' },
  { id: 'sauce-3', name: 'Creamy Avocado Cilantro', price: 15, calories: 65, protein: 1, carbs: 3, fat: 6, category: 'sauce', imageUrl: '/images/green_detox_smoothie.png' },
  { id: 'sauce-4', name: 'Chipotle Lime Vinaigrette', price: 12, calories: 45, protein: 0, carbs: 3, fat: 4, category: 'sauce', imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=200&q=80' },
];

const TOPPINGS: IngredientOption[] = [
  { id: 'top-1', name: 'Toasted Pumpkin & Chia Seeds', price: 12, calories: 45, protein: 2, carbs: 2, fat: 3.5, category: 'toppings', imageUrl: '/images/roasted_trail_mix.png' },
  { id: 'top-2', name: 'Roasted Almond Flakes', price: 15, calories: 55, protein: 2, carbs: 2, fat: 4.5, category: 'toppings', imageUrl: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=200&q=80' },
  { id: 'top-3', name: 'Crispy Chicken Crunch', price: 15, calories: 50, protein: 6, carbs: 2, fat: 2, category: 'toppings', imageUrl: '/images/grilled_chicken_wrap.png' },
  { id: 'top-4', name: 'Fresh Microgreens & Sesame', price: 10, calories: 10, protein: 1, carbs: 1, fat: 0, category: 'toppings', imageUrl: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=200&q=80' },
];

export const BowlBuilder: React.FC = () => {
  const addItem = useCartStore((state) => state.addItem);

  const [selectedBase, setSelectedBase] = useState<IngredientOption>(BASES[0]);
  const [selectedProtein, setSelectedProtein] = useState<IngredientOption>(PROTEINS[0]);
  const [selectedVeggies, setSelectedVeggies] = useState<IngredientOption[]>([VEGGIES[0], VEGGIES[2]]);
  const [selectedSauce, setSelectedSauce] = useState<IngredientOption>(SAUCES[0]);
  const [selectedToppings, setSelectedToppings] = useState<IngredientOption[]>([TOPPINGS[0]]);
  const [bowlName, setBowlName] = useState('My Custom Power Bowl');

  // Toggle Veggie selection (max 4)
  const toggleVeggie = (veg: IngredientOption) => {
    if (selectedVeggies.some((v) => v.id === veg.id)) {
      setSelectedVeggies(selectedVeggies.filter((v) => v.id !== veg.id));
    } else {
      if (selectedVeggies.length >= 4) {
        toast.error('You can select up to 4 mix-ins per bowl');
        return;
      }
      setSelectedVeggies([...selectedVeggies, veg]);
    }
  };

  // Toggle Topping selection (max 2)
  const toggleTopping = (top: IngredientOption) => {
    if (selectedToppings.some((t) => t.id === top.id)) {
      setSelectedToppings(selectedToppings.filter((t) => t.id !== top.id));
    } else {
      if (selectedToppings.length >= 2) {
        toast.error('You can select up to 2 crunchy toppings');
        return;
      }
      setSelectedToppings([...selectedToppings, top]);
    }
  };

  // Compute total price & macros
  const allSelected = [selectedBase, selectedProtein, ...selectedVeggies, selectedSauce, ...selectedToppings];

  const totalPrice = allSelected.reduce((sum, item) => sum + item.price, 0);
  const totalCalories = allSelected.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = allSelected.reduce((sum, item) => sum + item.protein, 0);
  const totalCarbs = allSelected.reduce((sum, item) => sum + item.carbs, 0);
  const totalFat = Math.round(allSelected.reduce((sum, item) => sum + item.fat, 0));

  const handleReset = () => {
    setSelectedBase(BASES[0]);
    setSelectedProtein(PROTEINS[0]);
    setSelectedVeggies([VEGGIES[0], VEGGIES[2]]);
    setSelectedSauce(SAUCES[0]);
    setSelectedToppings([TOPPINGS[0]]);
    toast.info('Reset bowl customization');
  };

  const handleAddToCart = () => {
    if (selectedVeggies.length < 3) {
      toast.warning('Should choose minimum 3 items', {
        description: `Currently selected ${selectedVeggies.length} veggie${selectedVeggies.length === 1 ? '' : 's'}. Please choose at least 3 items to build your bowl.`,
      });
      return;
    }

    const ingredientsList = allSelected.map((i) => i.name).join(', ');

    const customProduct: Product = {
      id: `custom-bowl-${Date.now()}`,
      handle: `custom-power-bowl-${Date.now()}`,
      title: bowlName || 'Custom Macro Power Bowl',
      productType: 'Custom Bowl',
      tags: ['Custom Bowl', 'Chef DIY', 'High Protein'],
      description: `Chef-crafted DIY Bowl with: ${ingredientsList}.\n\nCalories: ${totalCalories} kcal | Protein: ${totalProtein}g | Carbs: ${totalCarbs}g | Fat: ${totalFat}g | Fiber: 7g`,
      featuredImage: {
        url: '/images/hero_bowl.png',
        altText: bowlName,
      },
      images: [{ url: '/images/hero_bowl.png', altText: bowlName }],
      priceRange: {
        minVariantPrice: {
          amount: totalPrice.toString(),
          currencyCode: 'INR',
        },
      },
      variants: [
        {
          id: `variant-custom-${Date.now()}`,
          title: `Custom Portion (${totalProtein}g Protein)`,
          price: { amount: totalPrice.toString(), currencyCode: 'INR' },
          availableForSale: true,
        },
      ],
      nutrition: {
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
        fiber: 7,
      },
      prepTime: '20-25 mins',
    };

    addItem(customProduct);
    toast.success(`Added ${bowlName} to cart!`, {
      description: `${totalProtein}g Protein • ${totalCalories} kcal • ${formatCurrency(totalPrice)}`,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-3xl p-6 sm:p-8 shadow-card relative overflow-hidden carved-box">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-[var(--color-primary-muted)] opacity-40 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-[var(--color-primary-muted)] text-[var(--color-accent)] text-xs font-extrabold mb-2 border border-[var(--color-accent-glow)]">
              <ChefHat className="w-3.5 h-3.5" />
              <span>Brokole DIY Studio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Customize Your Power Bowl
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-1 max-w-lg">
              Build your custom healthy meal step-by-step. Pick your base, high-grade protein, fresh veggies, house dressing, and crunchy toppings with visual ingredient cards!
            </p>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs transition-all border border-white/20 carved-btn self-start sm:self-auto cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Selection</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Step-by-Step Selection Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* STEP 1: BASE */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs carved-box space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] font-black text-xs flex items-center justify-center">1</span>
                <span>Choose Your Base (Select 1)</span>
              </h3>
              <span className="text-xs font-bold text-[var(--color-text-muted)]">
                Selected: {selectedBase.name}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BASES.map((b) => {
                const isSelected = selectedBase.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBase(b)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer carved-btn flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] shadow-xs ring-1 ring-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                    }`}
                  >
                    <img
                      src={b.imageUrl}
                      alt={b.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[var(--color-border)] bg-white"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-extrabold text-xs text-[var(--color-text-main)] leading-snug truncate">
                          {b.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--color-text-muted)] font-semibold">
                        <span>{b.calories} kcal • {b.protein}g P</span>
                        <span className="font-black text-[var(--color-primary)]">+{formatCurrency(b.price)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: PROTEIN */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs carved-box space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] font-black text-xs flex items-center justify-center">2</span>
                <span>Choose Your Protein (Select 1)</span>
              </h3>
              <span className="text-xs font-bold text-[var(--color-primary)]">
                {selectedProtein.protein}g Protein
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROTEINS.map((p) => {
                const isSelected = selectedProtein.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProtein(p)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer carved-btn flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] shadow-xs ring-1 ring-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                    }`}
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[var(--color-border)] bg-white"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="font-extrabold text-xs text-[var(--color-text-main)] leading-snug truncate block">
                            {p.name}
                          </span>
                          {p.tag && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-[var(--color-accent-light)] text-[var(--color-text-on-accent)] text-[9px] font-black uppercase">
                              {p.tag}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--color-text-muted)] font-semibold">
                        <span>{p.calories} kcal • {p.protein}g P</span>
                        <span className="font-black text-[var(--color-primary)]">+{formatCurrency(p.price)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: VEGGIES & MIX-INS */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs carved-box space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] font-black text-xs flex items-center justify-center">3</span>
                <span>Select Fresh Veggies & Mix-ins (3 to 4 items)</span>
              </h3>
              <span className={`text-xs font-bold ${selectedVeggies.length < 3 ? 'text-amber-500 font-extrabold' : 'text-[var(--color-text-muted)]'}`}>
                {selectedVeggies.length}/4 Selected
              </span>
            </div>

            {/* Warning Banner if fewer than 3 items selected */}
            {selectedVeggies.length < 3 && (
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black shadow-xs animate-pulse">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Warning: Should choose minimum 3 items</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {VEGGIES.map((v) => {
                const isSelected = selectedVeggies.some((item) => item.id === v.id);
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleVeggie(v)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer carved-btn flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={v.imageUrl}
                        alt={v.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/20 bg-white"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-xs leading-tight block truncate">{v.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between text-[10px] opacity-90 font-bold border-t border-white/10 pt-1.5">
                      <span>{v.calories} kcal</span>
                      <span className={isSelected ? 'text-[var(--color-accent)] font-black' : 'text-[var(--color-text-main)]'}>
                        +{formatCurrency(v.price)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 4 & 5: SAUCE & TOPPINGS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Sauce */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs carved-box space-y-4">
              <h3 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] font-black text-xs flex items-center justify-center">4</span>
                <span>House Dressing (Select 1)</span>
              </h3>
              <div className="space-y-2.5">
                {SAUCES.map((s) => {
                  const isSelected = selectedSauce.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSauce(s)}
                      className={`w-full p-2.5 rounded-2xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-3 carved-btn ${
                        isSelected
                          ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
                          : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={s.imageUrl}
                          alt={s.name}
                          className="w-9 h-9 rounded-xl object-cover shrink-0 border border-[var(--color-border)] bg-white"
                        />
                        <span className="truncate">{s.name}</span>
                      </div>
                      <span className="text-[11px] font-black shrink-0">+{formatCurrency(s.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toppings */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs carved-box space-y-4">
              <h3 className="text-sm font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] font-black text-xs flex items-center justify-center">5</span>
                <span>Crunchy Toppings (Up to 2)</span>
              </h3>
              <div className="space-y-2.5">
                {TOPPINGS.map((t) => {
                  const isSelected = selectedToppings.some((item) => item.id === t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTopping(t)}
                      className={`w-full p-2.5 rounded-2xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-3 carved-btn ${
                        isSelected
                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                          : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={t.imageUrl}
                          alt={t.name}
                          className="w-9 h-9 rounded-xl object-cover shrink-0 border border-white/20 bg-white"
                        />
                        <span className="truncate">{t.name}</span>
                      </div>
                      <span className="text-[11px] font-black shrink-0">+{formatCurrency(t.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* Live Bowl Summary & Add to Cart Column */}
        <div className="sticky top-24 space-y-4">
          
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box space-y-5">
            
            {/* Custom Bowl Title Input */}
            <div>
              <label className="block text-xs font-extrabold uppercase text-[var(--color-text-muted)] mb-1">
                Name Your Bowl
              </label>
              <input
                type="text"
                value={bowlName}
                onChange={(e) => setBowlName(e.target.value)}
                placeholder="My Custom Power Bowl"
                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-black text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>

            {/* Live Macro Summary Card */}
            <div className="p-4 rounded-2xl bg-[var(--color-primary)] text-white shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-[var(--color-accent)]">
                <span className="flex items-center gap-1">
                  <Flame className="w-4 h-4 fill-[var(--color-accent)] text-[var(--color-accent)]" />
                  Live Nutrition Breakdown
                </span>
                <Sparkles className="w-3.5 h-3.5" />
              </div>

              {/* Total Calorie Highlight */}
              <div className="text-center py-1">
                <span className="text-3xl font-black text-white">{totalCalories}</span>
                <span className="text-xs font-bold text-emerald-200 ml-1">kcal total</span>
              </div>

              {/* Macro Pills */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/25 p-2 rounded-xl border border-white/10">
                  <span className="block text-base font-black text-[var(--color-accent)]">{totalProtein}g</span>
                  <span className="text-[9px] text-emerald-200 uppercase font-bold">Protein</span>
                </div>
                <div className="bg-black/25 p-2 rounded-xl border border-white/10">
                  <span className="block text-base font-black text-amber-300">{totalCarbs}g</span>
                  <span className="text-[9px] text-emerald-200 uppercase font-bold">Carbs</span>
                </div>
                <div className="bg-black/25 p-2 rounded-xl border border-white/10">
                  <span className="block text-base font-black text-orange-300">{totalFat}g</span>
                  <span className="text-[9px] text-emerald-200 uppercase font-bold">Fat</span>
                </div>
              </div>
            </div>

            {/* Ingredients Summary List */}
            <div className="space-y-2 text-xs">
              <span className="block font-extrabold text-[var(--color-text-main)]">Selected Bowl Ingredients:</span>
              <div className="space-y-1 text-[11px] text-[var(--color-text-muted)] font-medium">
                <div>• <strong className="text-[var(--color-text-main)]">Base:</strong> {selectedBase.name}</div>
                <div>• <strong className="text-[var(--color-text-main)]">Protein:</strong> {selectedProtein.name}</div>
                <div>• <strong className="text-[var(--color-text-main)]">Veggies:</strong> {selectedVeggies.map((v) => v.name).join(', ')}</div>
                <div>• <strong className="text-[var(--color-text-main)]">Dressing:</strong> {selectedSauce.name}</div>
                <div>• <strong className="text-[var(--color-text-main)]">Toppings:</strong> {selectedToppings.map((t) => t.name).join(', ')}</div>
              </div>
            </div>

            {/* Total Price & Add to Cart Button */}
            <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-muted)]">Custom Bowl Price</span>
                <span className="text-2xl font-black text-[var(--color-text-main)]">{formatCurrency(totalPrice)}</span>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full py-4 px-4 rounded-2xl bg-[var(--color-accent)] text-[var(--color-text-on-accent)] font-black text-sm hover:bg-[var(--color-accent-hover)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
              >
                <Plus className="w-5 h-5 stroke-[3px]" />
                <span>Add Custom Bowl to Cart</span>
              </button>

              {selectedVeggies.length < 3 && (
                <div className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black text-center shadow-xs">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  <span>Warning: Should choose minimum 3 items</span>
                </div>
              )}
            </div>

          </div>

          {/* Clean Quality Guarantee */}
          <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex items-center gap-2 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
            <span>100% Organic ingredients assembled fresh by our chef team.</span>
          </div>

        </div>

      </div>
    </div>
  );
};
