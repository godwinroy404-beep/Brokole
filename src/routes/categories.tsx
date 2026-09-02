import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { fetchProducts, Product } from '../lib/shopify';
import { ProductCard } from '../components/ProductCard';
import { CATEGORIES } from '../components/CategoryStrip';
import { Grid, Sparkles } from 'lucide-react';

export const Route = createFileRoute('/categories')({
  loader: async () => {
    const products = await fetchProducts();
    return { products };
  },
  head: () => ({
    meta: [
      { title: 'Meal Categories — Bro-Ko-Le' },
      { name: 'description', content: 'Explore healthy meal categories: High Protein, Low Carb, Keto, Vegan, Smoothies, and Snacks.' },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { products } = Route.useLoaderData();
  const [activeCategory, setActiveCategory] = useState('High Protein');

  const filteredProducts = products.filter((p: Product) => {
    if (activeCategory === 'All') return true;
    return (
      p.tags.some((t: string) => t.toLowerCase() === activeCategory.toLowerCase()) ||
      p.productType.toLowerCase() === activeCategory.toLowerCase()
    );
  });

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-4">
      {/* Page Title */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="p-3 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          <Grid className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text-main)] tracking-tight flex items-center gap-2">
            <span>Browse by Dietary Goal</span>
            <Sparkles className="w-4 h-4 text-[var(--color-accent)] fill-[var(--color-accent)]" />
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Select a nutrition category to match your specific dietary preferences
          </p>
        </div>
      </div>

      {/* Category Pills Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`p-3.5 rounded-2xl border text-left font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2.5 ${
                isSelected
                  ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] shadow-md scale-[1.01]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-primary)]'}`} />
              <span className="truncate">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Meals Grid */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text-main)]">
            Showing {activeCategory} Meals ({filteredProducts.length})
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
