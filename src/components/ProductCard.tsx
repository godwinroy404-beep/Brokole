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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success(`Added ${product.title} to cart`, {
      description: `${product.nutrition.protein}g Protein | ${product.nutrition.calories} kcal`,
      duration: 2500,
    });
  };

  return (
    <div className="group relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between carved-box">
      
      {/* Product Image & Badges */}
      <Link to="/product/$handle" params={{ handle: product.handle }} className="block relative aspect-4/3 overflow-hidden bg-[var(--color-surface-hover)] rounded-t-[1.65rem]">
        <img
          src={product.featuredImage.url}
          alt={product.featuredImage.altText || product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Popular / Deal Badge */}
        {product.isPopular && (
          <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-2xl bg-[var(--color-deal)] text-[var(--color-text-on-deal)] text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
            POPULAR
          </div>
        )}



        {/* Macro Badge Top Right */}
        <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-2xl bg-[var(--color-surface)]/90 backdrop-blur-xs text-[var(--color-primary)] text-[11px] font-bold border border-[var(--color-border)] flex items-center gap-1 shadow-xs">
          <Flame className="w-3.5 h-3.5 fill-[var(--color-deal)] text-[var(--color-deal)]" />
          <span>{product.nutrition.protein}g Protein</span>
        </div>
      </Link>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category / Type */}
          <div className="text-[11px] font-extrabold text-[var(--color-primary-muted)] uppercase tracking-wider mb-1">
            {product.productType || 'Healthy Meal'}
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[var(--color-accent)] text-[var(--color-text-on-accent)] font-extrabold text-xs hover:bg-[var(--color-accent-hover)] active:scale-95 transition-all cursor-pointer shadow-xs carved-btn"
            aria-label={`Add ${product.title} to cart`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3px]" />
            <span>{inCartQty > 0 ? `ADD (${inCartQty})` : 'ADD'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
