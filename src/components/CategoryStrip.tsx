import { Flame, Salad, Coffee, Milk, Cookie, Sprout, Scale, Layers, ChefHat, Calendar, Utensils, Sandwich } from 'lucide-react';
export const CATEGORIES = [
  { id: 'All', label: 'All Meals', icon: Layers },
  { id: 'Grain & Protein Bowls', label: 'Grain Bowls', icon: Utensils },
  { id: 'Wraps', label: 'Healthy Wraps', icon: Sandwich },
  { id: 'Salads & Bowls', label: 'Salads & Bowls', icon: Salad },
  { id: 'Smoothies & Juices', label: 'Smoothies & Juices', icon: Milk },
  { id: 'High Protein', label: 'High Protein', icon: Flame },
  { id: 'Subscriptions', label: 'Meal Plans', icon: Calendar },
  { id: 'Custom Bowl', label: 'Build Your Bowl', icon: ChefHat },
  { id: 'Breakfast', label: 'Breakfast', icon: Coffee },
  { id: 'Healthy Snacks', label: 'Healthy Snacks', icon: Cookie },
  { id: 'Vegan', label: 'Vegan', icon: Sprout },
  { id: 'Low Carb', label: 'Low Carb', icon: Scale },
];

interface CategoryStripProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryStrip: React.FC<CategoryStripProps> = ({ selectedCategory, onSelectCategory }) => {
  return (
    <div className="w-full overflow-x-auto no-scrollbar py-3 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2.5 max-w-7xl mx-auto min-w-max">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-4.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer border carved-btn ${
                isSelected
                  ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] shadow-sm scale-[1.02]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
