import React, { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { fetchProducts, Product } from '../lib/shopify';
import { useProductStore } from '../store/useProductStore';
import { ProductCard } from '../components/ProductCard';
import { CATEGORIES } from '../components/CategoryStrip';
import { Utensils, Sparkles, Filter, ArrowUpDown, LayoutGrid, List, Flame, ChefHat, Calendar, Search, ShieldCheck } from 'lucide-react';

export const Route = createFileRoute('/menu')({
  loader: async () => {
    const products = await fetchProducts();
    return { products };
  },
  head: () => ({
    meta: [
      { title: 'Full Menu — Bro-Ko-Le Healthy Chef Meals' },
      { name: 'description', content: 'Explore our full menu of macro-balanced, high-protein chef-crafted meals available for pre-order.' },
    ],
  }),
  component: MenuPage,
});

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'protein-desc' | 'calories-asc';

function MenuPage() {
  const { products: initialProducts } = Route.useLoaderData();
  const storeProducts = useProductStore((state) => state.products);

  const products = storeProducts && storeProducts.length > 0 ? storeProducts : initialProducts;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [highProteinOnly, setHighProteinOnly] = useState(false);
  const [lowCalOnly, setLowCalOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      result = result.filter(
        (p) =>
          p.tags.some((t) => t.toLowerCase() === selectedCategory.toLowerCase()) ||
          p.productType.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // High protein filter (>30g)
    if (highProteinOnly) {
      result = result.filter((p) => (p.nutrition?.protein || 0) >= 30);
    }

    // Low calorie filter (<400 kcal)
    if (lowCalOnly) {
      result = result.filter((p) => (p.nutrition?.calories || 999) < 400);
    }

    // Sorting logic
    result.sort((a, b) => {
      const priceA = parseFloat(a.priceRange.minVariantPrice.amount);
      const priceB = parseFloat(b.priceRange.minVariantPrice.amount);

      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
      if (sortBy === 'protein-desc') return (b.nutrition?.protein || 0) - (a.nutrition?.protein || 0);
      if (sortBy === 'calories-asc') return (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0);
      return 0; // default featured order
    });

    return result;
  }, [products, searchQuery, selectedCategory, sortBy, highProteinOnly, lowCalOnly]);

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      {/* Page Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-700/40">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-200 text-xs font-black uppercase tracking-wider">
            <Utensils className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Chef & Dietitian Menu</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Full Menu Catalog
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Freshly prepared, macro-tracked meal bowls, salads, smoothies & healthy snacks available for pre-order to your doorstep.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold text-emerald-200">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              100% Clean Ingredients
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              Macros Pre-Calculated
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Tabs, Sorting, View Modes */}
      <div className="space-y-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 shadow-xs carved-box">
        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes or ingredients..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs sm:text-sm text-[var(--color-text-main)] placeholder-[var(--color-text-light)] focus:outline-none focus:border-[var(--color-primary)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Right controls: Sorting & View Mode */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl px-3 py-2 text-xs font-bold text-[var(--color-text-main)]">
              <ArrowUpDown className="w-4 h-4 text-[var(--color-primary)]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent focus:outline-none cursor-pointer text-xs font-extrabold"
              >
                <option value="featured">Featured Dishes</option>
                <option value="protein-desc">Highest Protein</option>
                <option value="calories-asc">Lowest Calories</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>

            {/* Layout Toggle */}
            <div className="flex items-center bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="List view"
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 pb-1 border-t border-[var(--color-border-subtle)]">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (cat.id === 'Custom Bowl') return;
                  if (cat.id === 'Subscriptions') return;
                  setSelectedCategory(cat.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] shadow-sm'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-primary)]'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-[var(--color-text-muted)] font-bold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            Macro Filters:
          </span>

          <button
            onClick={() => setHighProteinOnly(!highProteinOnly)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              highProteinOnly
                ? 'bg-amber-500/10 border-amber-500 text-amber-600 font-extrabold'
                : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-amber-400'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>High Protein (&gt;30g)</span>
          </button>

          <button
            onClick={() => setLowCalOnly(!lowCalOnly)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              lowCalOnly
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-extrabold'
                : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Low Calorie (&lt;400 kcal)</span>
          </button>

          {(highProteinOnly || lowCalOnly || selectedCategory !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setHighProteinOnly(false);
                setLowCalOnly(false);
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-[var(--color-primary)] hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Promos Grid: DIY Bowl & Subscription quick entry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between shadow-xs carved-box">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
              <ChefHat className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-[var(--color-text-main)]">Want a custom meal?</h4>
              <p className="text-xs text-[var(--color-text-muted)]">Build your own protein bowl step by step</p>
            </div>
          </div>
          <Link
            to="/custom-bowl"
            className="px-3.5 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-black hover:bg-[var(--color-primary-hover)] transition-all carved-btn"
          >
            DIY Bowl
          </Link>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between shadow-xs carved-box">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-[var(--color-text-main)]">Daily Meal Plans</h4>
              <p className="text-xs text-[var(--color-text-muted)]">Subscribe weekly & save up to 25%</p>
            </div>
          </div>
          <Link
            to="/subscriptions"
            className="px-3.5 py-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-on-accent)] text-xs font-black hover:bg-[var(--color-accent-hover)] transition-all carved-btn"
          >
            Subscribe
          </Link>
        </div>
      </div>

      {/* Product Display Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text-main)] flex items-center gap-2">
            <span>Dishes</span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black">
              {filteredProducts.length}
            </span>
          </h2>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-10 text-center max-w-md mx-auto carved-box">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
              <Utensils className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text-main)] mb-1">No matching meals</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Try adjusting your search terms or filters to find delicious options.
            </p>
            <button
              onClick={() => {
                setHighProteinOnly(false);
                setLowCalOnly(false);
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold"
            >
              Clear All Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          /* List View Mode */
          <div className="space-y-3">
            {filteredProducts.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
