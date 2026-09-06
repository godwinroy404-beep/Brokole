import React, { useState, useEffect } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { fetchProducts, Product } from '../lib/shopify';
import { HeroBanner } from '../components/HeroBanner';
import { CategoryStrip } from '../components/CategoryStrip';
import { ProductCard } from '../components/ProductCard';
import { Sparkles, Utensils, MessageSquarePlus, ChefHat, ArrowRight, Calendar, Zap } from 'lucide-react';

import { useProductStore } from '../store/useProductStore';

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    return {
      q: (search.q as string) || undefined,
    };
  },
  loader: async () => {
    const products = await fetchProducts();
    return { products };
  },
  head: () => ({
    meta: [
      { title: 'Brokole - Pre-Order Fresh Healthy Meals' },
      { name: 'description', content: 'Chef and dietitian-designed macro-balanced healthy meals. Pre-order fresh high protein, low carb, clean nutrition.' },
      { property: 'og:title', content: 'Brokole - Pre-Order Fresh Healthy Meals' },
      { property: 'og:description', content: 'Macro-balanced, high-protein chef meals available for pre-order.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Brokole - Pre-Order Fresh Healthy Meals' },
      { property: 'twitter:description', content: 'Macro-balanced, high-protein chef meals available for pre-order.' },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { products: initialProducts } = Route.useLoaderData();
  const storeProducts = useProductStore((state) => state.products);
  const searchParams = Route.useSearch();
  const searchQuery = searchParams?.q || '';
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Merge storeProducts and initialProducts cleanly
  const allProducts = React.useMemo(() => {
    const list = storeProducts && storeProducts.length > 0 ? storeProducts : initialProducts;
    return list;
  }, [storeProducts, initialProducts]);

  const handleSelectCategory = (cat: string) => {
    if (cat === 'Custom Bowl') {
      navigate({ to: '/custom-bowl' });
    } else if (cat === 'Subscriptions') {
      navigate({ to: '/subscriptions' });
    } else {
      setSelectedCategory(cat);
    }
  };

  // Filter products by selected category and search query
  const filteredProducts = allProducts.filter((p: Product) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      p.tags.some((t: string) => t.toLowerCase() === selectedCategory.toLowerCase()) ||
      p.productType.toLowerCase() === selectedCategory.toLowerCase();

    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* SEO Title fallback */}
      <title>Brokole - Pre-Order Fresh Healthy Meals</title>

      {/* Hero Banner */}
      <HeroBanner />

      {/* Category Strip */}
      <CategoryStrip
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />

      {/* Featured Callouts: DIY Bowl & Subscription Plans Grid */}
      <div className="mx-4 sm:mx-6 lg:mx-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* DIY Bowl Callout */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black">
              <ChefHat className="w-4 h-4 text-[var(--color-accent)]" />
              <span>DIY Bowl Studio</span>
            </div>
            <h3 className="text-xl font-black text-[var(--color-text-main)] tracking-tight">
              Customize Your Own Bowl
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed">
              Pick your exact grain base, protein (chicken, salmon, paneer, tofu), 4 fresh veggies & house dressing!
            </p>
          </div>

          <Link
            to="/custom-bowl"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--color-primary)] text-white font-extrabold text-xs hover:bg-[var(--color-primary-hover)] transition-all shadow-xs carved-btn cursor-pointer self-start"
          >
            <span>Build Custom Bowl</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Subscription Plans Callout */}
        <div className="bg-[var(--color-primary)] text-white border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-[var(--color-accent)] opacity-20 blur-xl pointer-events-none" />

          <div className="space-y-2 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-white/10 text-[var(--color-accent)] text-xs font-black border border-white/20">
              <Calendar className="w-4 h-4" />
              <span>Save 25% Monthly</span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">
              Weekly & Monthly Meal Subscriptions
            </h3>
            <p className="text-xs text-emerald-100 font-medium leading-relaxed">
              Automate your fresh healthy eating with pre-order deliveries, 1-on-1 dietitian support & free pause/cancel.
            </p>
          </div>

          <Link
            to="/subscriptions"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--color-accent)] text-[var(--color-text-on-accent)] font-extrabold text-xs hover:bg-[var(--color-accent-hover)] transition-all shadow-xs carved-btn cursor-pointer relative z-10 self-start"
          >
            <span>View Subscription Plans</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

      {/* Menu Section */}
      <section id="menu-section" className="px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text-main)] tracking-tight">
              Today's Fresh Menu
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-medium">
              {filteredProducts.length} chef-crafted high protein meals available now
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/menu"
              className="px-3.5 py-1.5 rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-black hover:bg-[var(--color-primary)] hover:text-white transition-all carved-btn"
            >
              View Full Menu &rarr;
            </Link>

            {selectedCategory !== 'All' && (
              <button
                onClick={() => setSelectedCategory('All')}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Product Grid: 2 columns on mobile, up to 4 on desktop */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 text-center my-6 max-w-md mx-auto shadow-subtle carved-box">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
              <Utensils className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text-main)] mb-1">No meals found</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
              Tell the chat what dish to add and at what price.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] font-medium">
              <MessageSquarePlus className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Prompt AI to add new dishes</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
