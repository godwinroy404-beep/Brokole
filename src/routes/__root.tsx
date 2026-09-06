import React from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { CartDrawer } from '../components/CartDrawer';
import { AuthModal } from '../components/AuthModal';
import { OrderStatusBanner } from '../components/OrderStatusBanner';
import { NotFoundPage } from '../components/NotFoundPage';
import { Toaster } from 'sonner';
import { useCartSync } from '../hooks/useCartSync';
import { useAppBootstrap } from '../hooks/useAppBootstrap';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  useCartSync();
  useAppBootstrap();

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-main)] flex flex-col antialiased">
      {/* Sonner Toast Notifications */}
      <Toaster position="top-right" richColors theme="light" />

      {/* Global Header */}
      <Header />

      {/* Live Order Status Tracker Bar (Appears only after placing an order) */}
      <OrderStatusBanner />

      {/* Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto pb-16 md:pb-8">
        <Outlet />
      </main>

      {/* Slide-over Cart Drawer */}
      <CartDrawer />

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

