import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Home, Utensils, Grid, Activity, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  if (currentPath.startsWith('/kitchen')) {
    return null;
  }

  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Menu', path: '/menu', icon: Utensils },
    { label: 'Categories', path: '/categories', icon: Grid },
    { label: 'My Macros', path: '/my-macros', icon: Activity },
    { label: 'Account', path: '/account', icon: User },
  ];

  return (
    <nav aria-label="Bottom Navigation" className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass-nav border-t border-[var(--color-border)] px-3 py-2 shadow-lg">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${isActive
                  ? 'text-[var(--color-primary)] font-bold bg-[var(--color-primary-light)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] text-[var(--color-primary)]' : 'stroke-[1.8px]'}`} />
              <span className="text-[11px] leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
