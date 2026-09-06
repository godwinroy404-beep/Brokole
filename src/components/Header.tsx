import React, { useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { ShoppingBag, Search, Leaf, User, Utensils } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';

interface HeaderProps {
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const totalItems = useCartStore((state) => state.getTotalItems());
  const toggleCart = useCartStore((state) => state.toggleCart);

  const { user, isLoggedIn, openAuthModal } = useAuthStore();
  const navigate = useNavigate();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: '/', search: { q: searchQuery.trim() } as any });
    }
  };

  const routerState = useRouterState();
  const isKitchenPage = routerState.location.pathname.startsWith('/kitchen');

  return (
    <header className="sticky top-0 z-40 w-full glass-header border-b border-[var(--color-border-subtle)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="Brokole Logo"
                className="w-10 h-10 rounded-2xl object-cover shadow-xs group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="font-black text-xl tracking-tight leading-none text-[var(--color-text-main)] flex items-center gap-0.5">
                  Bro<span className="text-[var(--color-primary)]">kole</span>
                </span>
                <span className="text-[10px] font-bold tracking-wider text-[var(--color-text-muted)] uppercase">
                  Chef & Dietitian Meals
                </span>
              </div>
            </Link>
          </div>

          {/* Search Bar (Hidden on Kitchen Portal) */}
          {!isKitchenPage && (
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search high-protein, low carb..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm text-[var(--color-text-main)] placeholder-[var(--color-text-light)] focus:outline-none focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface)] transition-all shadow-xs"
                />
              </div>
            </form>
          )}

          {/* Desktop Navigation Links (Hidden strictly on Kitchen Portal) */}
          {!isKitchenPage ? (
            <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-1.5 font-extrabold text-xs">
              <Link
                to="/menu"
                className="px-3 py-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
              >
                Full Menu
              </Link>
              <Link
                to="/custom-bowl"
                className="px-3 py-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
              >
                DIY Bowl
              </Link>
              <Link
                to="/subscriptions"
                className="px-3 py-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
              >
                Meal Plans
              </Link>
              <Link
                to="/my-macros"
                className="px-3 py-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
              >
                My Macros
              </Link>
            </nav>
          ) : (
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-xs font-black">
              <span>🔐 Executive Operations Desk</span>
            </div>
          )}

          {/* User Auth & Cart Icons */}
          <div className="flex items-center gap-2">

            {/* User Login Button or Avatar */}
            {isLoggedIn && user ? (
              <Link
                to="/account"
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-extrabold text-[var(--color-text-main)] hover:border-[var(--color-primary-muted)] transition-all carved-btn"
              >
                <div className="w-6 h-6 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center font-black text-xs">
                  {user.name.charAt(0)}
                </div>
                <span className="truncate max-w-[90px]">{user.name.split(' ')[0]}</span>
              </Link>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-extrabold border border-[var(--color-border)] hover:bg-[var(--color-primary)] hover:text-white transition-all cursor-pointer carved-btn"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}

            {/* Cart Icon */}
            <button
              onClick={toggleCart}
              aria-label="Open cart"
              className="relative p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary-muted)] transition-all flex items-center justify-center cursor-pointer shadow-xs carved-btn"
            >
              <ShoppingBag className="w-5 h-5 text-[var(--color-primary)]" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-[var(--color-deal)] text-[var(--color-text-on-deal)] font-black text-xs rounded-full flex items-center justify-center shadow-xs">
                  {totalItems}
                </span>
              )}
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
