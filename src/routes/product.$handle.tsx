import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate, notFound } from '@tanstack/react-router';
import { fetchProductByHandle, ProductVariant } from '../lib/shopify';
import { NutritionLabel } from '../components/NutritionLabel';
import { formatCurrency } from '../lib/nutritionParser';
import { useCartStore, scaleNutritionForVariant } from '../store/useCartStore';
import { ArrowLeft, Clock, ShieldCheck, Flame, Plus, Check, Zap, ShoppingBag, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/product/$handle')({
  loader: async ({ params }) => {
    const product = await fetchProductByHandle(params.handle);
    if (!product) {
      throw notFound();
    }
    return { product };
  },
  head: () => ({
    meta: [
      { title: 'Meal details - Brokole healthy food delivery' },
      { name: 'description', content: 'Detailed macro facts, ingredients, and nutrition info for Brokole chef-crafted meals.' },
      { property: 'og:title', content: 'Meal details - Brokole healthy food delivery' },
      { property: 'og:description', content: 'Chef and dietitian-designed macro-balanced healthy meal details.' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { product } = Route.useLoaderData();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const toggleCart = useCartStore((state) => state.toggleCart);
  const totalCartItems = useCartStore((state) => state.getTotalItems());

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants[0] || {
      id: `${product.id}-default`,
      title: 'Standard Portion',
      price: product.priceRange.minVariantPrice,
      availableForSale: product.isAvailable !== false,
    }
  );

  const [selectedImage, setSelectedImage] = useState<string>(product.featuredImage.url);
  const [quantity, setQuantity] = useState<number>(1);

  const isAvailable = product.isAvailable !== false && selectedVariant.availableForSale;

  // Scaled nutrition based on selected portion size (Medium +25%, Large +50%)
  const currentNutrition = React.useMemo(() => {
    return scaleNutritionForVariant(product.nutrition, selectedVariant.title);
  }, [product.nutrition, selectedVariant.title]);

  const priceAmount = parseFloat(selectedVariant.price.amount) || parseFloat(product.priceRange.minVariantPrice.amount);
  const formattedPrice = formatCurrency(priceAmount, selectedVariant.price.currencyCode);

  const handleAddToCart = () => {
    if (!isAvailable) {
      toast.error(`${product.title} is currently out of stock`);
      return;
    }
    addItem(product, selectedVariant, quantity);
    toast.success(`Added ${quantity}x ${product.title} to cart`, {
      description: `${selectedVariant.title} • ${currentNutrition.protein * quantity}g Protein | ${currentNutrition.calories * quantity} kcal`,
      duration: 3000,
    });
  };

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-4">
      {/* SEO Title */}
      <title>{`${product.title} - Brokole`}</title>

      {/* Detail Page Sticky Sub-Header with Back Button & Cart */}
      <div className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] mb-4">
        <button
          onClick={() => navigate({ to: '/' })}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Menu</span>
        </button>

        <button
          onClick={toggleCart}
          className="relative p-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer"
          aria-label="Cart"
        >
          <ShoppingBag className="w-5 h-5 text-[var(--color-primary)]" />
          {totalCartItems > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--color-deal)] text-[var(--color-text-on-deal)] font-bold text-[10px] rounded-full flex items-center justify-center">
              {totalCartItems}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Image Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-4/3 rounded-3xl overflow-hidden bg-neutral-900 border border-[var(--color-border)] shadow-card">
            <img
              src={selectedImage}
              alt={product.title}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${!isAvailable ? 'grayscale-[30%]' : ''}`}
            />
            {/* Delivery / Out of Stock Badge Overlay */}
            {!isAvailable ? (
              <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-emerald-500 text-neutral-950 text-xs font-black flex items-center gap-1.5 z-10 shadow-md">
                <AlertCircle className="w-4 h-4" />
                <span>Out of Stock / Sold Out</span>
              </div>
            ) : (
              <div className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 z-10 shadow-md">
                <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 animate-pulse" />
                <span>Pre-Order Fresh Delivery</span>
              </div>
            )}
          </div>

          {/* Image Thumbnails if multiple exist */}
          {product.images && product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {product.images.map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img.url)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                    selectedImage === img.url ? 'border-[var(--color-primary)] scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt={img.altText || product.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Title, Price, Portion Selector, CTA & Nutrition Label */}
        <div className="space-y-6">
          
          {/* Header Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-extrabold uppercase">
                {product.productType || 'Chef Special'}
              </span>
              {!isAvailable ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-extrabold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Currently Out of Stock
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-accent-light)] text-[var(--color-text-on-accent)] text-xs font-extrabold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-[var(--color-accent)] text-[var(--color-accent)]" />
                  {currentNutrition.protein}g Protein ({currentNutrition.calories} kcal)
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-main)] tracking-tight mb-2">
              {product.title}
            </h1>

            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {product.description.split('\n')[0]}
            </p>
          </div>

          {/* Price & Variant Selector */}
          <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[var(--color-text-muted)] block">Price per serving</span>
                <span className="text-2xl font-black text-[var(--color-text-main)]">{formattedPrice}</span>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={!isAvailable}
                  className="w-8 h-8 rounded-lg bg-[var(--color-surface)] font-bold text-sm text-[var(--color-text-main)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span className="text-sm font-black px-2">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={!isAvailable}
                  className="w-8 h-8 rounded-lg bg-[var(--color-surface)] font-bold text-sm text-[var(--color-text-main)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Variant Options */}
            {product.variants.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Select Portion Size / Option
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {product.variants.map((v: ProductVariant) => {
                    const isSelected = selectedVariant.id === v.id;
                    const vPrice = formatCurrency(parseFloat(v.price.amount), v.price.currencyCode);
                    const vNutr = scaleNutritionForVariant(product.nutrition, v.title);
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                          isSelected
                            ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)] shadow-xs'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary-muted)]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate">{v.title}</span>
                          <span>{vPrice}</span>
                        </div>
                        <span className="text-[10px] opacity-80 font-semibold">
                          {vNutr.protein}g Protein • {vNutr.calories} kcal
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add to Cart CTA */}
            <button
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className={`w-full py-3.5 px-4 rounded-[var(--color-radius-btn)] font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                !isAvailable
                  ? 'bg-neutral-300 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-not-allowed opacity-80'
                  : 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isAvailable ? (
                <>
                  <Plus className="w-5 h-5 stroke-[3px]" />
                  <span>Add to Cart - {formatCurrency(priceAmount * quantity)}</span>
                </>
              ) : (
                <span>Currently Out of Stock</span>
              )}
            </button>
          </div>

          {/* FDA-Style Nutrition Facts Panel */}
          <NutritionLabel nutrition={currentNutrition} portionName={selectedVariant.title} />

          {/* About this meal Section */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--color-radius-card)] p-5 shadow-xs space-y-3">
            <h3 className="text-base font-bold text-[var(--color-text-main)] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--color-primary)]" />
              <span>About This Meal</span>
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {product.tags.map((t: string, idx: number) => (
                <span key={idx} className="px-2.5 py-1 rounded-md bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-muted)]">
                  #{t}
                </span>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
