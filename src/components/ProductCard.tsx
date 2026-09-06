import React from 'react';
import { Link } from '@tanstack/react-router';
import { Plus, Flame } from 'lucide-react';
import { Product } from '../lib/shopify';
import { formatCurrency } from '../lib/nutritionParser';
import { useCartStore } from '../store/useCartStore';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  const priceAmount = parseFloat(product.priceRange.minVariantPrice.amount);
  const formattedPrice = formatCurrency(priceAmount, product.priceRange.minVariantPrice.currencyCode);

  // Check if item is already in cart
  const itemInCart = cartItems.find((item) => item.product.id === product.id);
  const inCartQty = itemInCart ? itemInCart.quantity : 0;
  const isAvailable = product.isAvailable !== false && (product.variants.length === 0 || product.variants.some((v) => v.availableForSale));

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable) {
      toast.error(`${product.title} is currently out of stock`);
      return;
    }
    addItem(product);
    toast.success(`Added ${product.title} to cart`, {
      description: `${product.nutrition.protein}g Protein | ${product.nutrition.calories} kcal`,
      duration: 2500,
    });
  };

  return (
    <div className={`group relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between carved-box ${!isAvailable ? 'opacity-85' : ''}`}>
      
      {/* Product Image & Badges */}
      <Link to="/product/$handle" params={{ handle: product.handle }} className="block relative aspect-4/3 overflow-hidden bg-neutral-900 rounded-t-[1.65rem]">
        <img
          src={product.featuredImage.url}
          alt={product.featuredImage.altText || product.title}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${isAvailable ? 'group-hover:scale-105' : 'grayscale-[30%]'}`}
          loading="lazy"
        />

        {/* Badges Overlay Header */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 z-10 pointer-events-none">
          <div className="shrink-0">
            {!isAvailable ? (
              <span className="px-2.5 py-1 rounded-2xl bg-emerald-500 text-neutral-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-xs block">
                OUT OF STOCK
              </span>
            ) : product.isPopular ? (
              <span className="px-2.5 py-1 rounded-2xl bg-[var(--color-deal)] text-[var(--color-text-on-deal)] text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider shadow-xs block">
                POPULAR
              </span>
            ) : null}
          </div>

          <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-2xl bg-[var(--color-surface)]/95 backdrop-blur-md text-[var(--color-primary)] text-[10px] sm:text-[11px] font-bold border border-[var(--color-border)] flex items-center gap-1 shadow-xs shrink-0 ml-auto">
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[var(--color-deal)] text-[var(--color-deal)] shrink-0" />
            <span className="whitespace-nowrap">{product.nutrition.protein}g Protein</span>
          </div>
        </div>
      </Link>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category / Type */}
          <div className="text-[11px] font-extrabold text-[var(--color-primary-muted)] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{product.productType || 'Healthy Meal'}</span>
            {!isAvailable && (
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">Sold Out</span>
            )}
          </div>

          {/* Title */}
          <Link to="/product/$handle" params={{ handle: product.handle }}>
            <h3 className="text-xs sm:text-sm font-extrabold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 leading-snug mb-1.5">
              {product.title}
            </h3>
          </Link>

          {/* Macro Breakdown Pills */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] mb-3">
            <span className="font-semibold">{product.nutrition.calories} kcal</span>
            <span>•</span>
            <span>{product.nutrition.carbs}g Carbs</span>
            <span>•</span>
            <span>{product.nutrition.fat}g Fat</span>
          </div>
        </div>

        {/* Price & Add Button Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[var(--color-border-subtle)] mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--color-text-muted)] leading-none mb-0.5">Price</span>
            <span className="text-sm sm:text-base font-black text-[var(--color-text-main)]">
              {formattedPrice}
            </span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-extrabold text-xs transition-all shadow-xs carved-btn ${
              !isAvailable
                ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-75'
                : 'bg-[var(--color-accent)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] active:scale-95 cursor-pointer'
            }`}
            aria-label={isAvailable ? `Add ${product.title} to cart` : `${product.title} is out of stock`}
          >
            {isAvailable ? (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                <span>{inCartQty > 0 ? `ADD (${inCartQty})` : 'ADD'}</span>
              </>
            ) : (
              <span>OUT OF STOCK</span>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};
