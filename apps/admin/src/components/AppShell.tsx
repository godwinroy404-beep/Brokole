import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, UtensilsCrossed, LogOut, ShieldCheck, CalendarRange, Boxes, Users, BarChart3, ChefHat } from 'lucide-react';
import { ROLE_LABELS, fetchCloudOrders } from '@brokole/domain';
import { Toaster, toast } from 'sonner';
import type { AdminSession } from '../lib/useSession';
import { OrdersScreen } from '../screens/OrdersScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { SalesReportScreen } from '../screens/SalesReportScreen';
import { PowerBowlScreen } from '../screens/PowerBowlScreen';

type Tab = 'orders' | 'subscriptions' | 'power-bowl' | 'inventory' | 'customers' | 'menu' | 'sales';

const TAB_NAMES: Tab[] = ['orders', 'subscriptions', 'power-bowl', 'inventory', 'customers', 'menu', 'sales'];

function getBasePath(): string {
  if (typeof window === 'undefined') return '/admin';
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/ops-console')) return '/ops-console';
  if (path.startsWith('/admin')) return '/admin';
  return '';
}

function getTabFromUrl(): Tab {
  if (typeof window === 'undefined') return 'orders';
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');

  if (hash && (TAB_NAMES as string[]).includes(hash)) {
    return hash as Tab;
  }

  const segments = path.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if ((TAB_NAMES as string[]).includes(seg)) {
      return seg as Tab;
    }
  }

  return 'orders';
}

export function AppShell({ session }: { session: AdminSession }) {
  const [tab, setTabState] = useState<Tab>(() => getTabFromUrl());
  const profile = session.profile!;

  // Live Notification Badges Metrics
  const [stats, setStats] = useState({
    newOrders: 0,
    activeOrders: 0,
    skippedToday: 0,
    activeSubscriptions: 0,
  });

  const updateBadges = useCallback(async () => {
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const todayDayNum = new Date().getDate();

      let localSkips: string[] = [];
      try {
        const saved = localStorage.getItem('bkl_skipped_dates');
        if (saved) localSkips = JSON.parse(saved);
      } catch {}

      // 1. Fetch disk orders
      let allOrders: any[] = [];
      try {
        const res = await fetch('/api/local-orders-sync');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.orders)) allOrders = data.orders;
        }
      } catch {}

      // 2. Merge cloud orders
      try {
        const cloudData = await fetchCloudOrders();
          const map = new Map<string, any>();
          allOrders.forEach((o) => {
            const key = String(o.id || o.order_no || '');
            if (key) map.set(key, o);
          });
          cloudData.forEach((o) => {
            const key = String(o.id || o.order_no || '');
            if (!o.deleted && key) {
              map.set(key, { ...map.get(key), ...o });
            }
          });
          allOrders = Array.from(map.values());
      } catch {}

      const isSub = (o: any) =>
        o.channel === 'subscription' ||
        String(o.id || o.order_no || '').startsWith('BKL-SUB-') ||
        (o.notes && o.notes.toLowerCase().includes('plan')) ||
        (o.notes && o.notes.toLowerCase().includes('subscription')) ||
        (o.itemsSummary && (o.itemsSummary.toLowerCase().includes('subscription') || o.itemsSummary.toLowerCase().includes('plan')));

      let newCount = 0;
      let activeCount = 0;
      let skippedCount = 0;
      let subCount = 0;

      for (const o of allOrders) {
        const st = String(o.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'canceled' || st === 'refunded' || o.deleted) continue;

        if (st !== 'delivered') {
          activeCount++;
          if (st === 'placed' || st === 'new order' || st === 'paid') {
            newCount++;
          }
        }

        if (isSub(o)) {
          subCount++;
          const rawSkipped = o.skipped_days || [];
          const isSkippedToday =
            rawSkipped.some((d: any) => String(d).trim() === todayIso || String(d).trim() === String(todayDayNum)) ||
            localSkips.includes(todayIso) ||
            (o.notes && o.notes.includes('[SKIPPED_DAYS:') && (o.notes.includes(todayIso) || o.notes.includes(String(todayDayNum))));

          if (isSkippedToday) {
            skippedCount++;
          }
        }
      }

      setStats({
        newOrders: newCount,
        activeOrders: activeCount,
        skippedToday: skippedCount,
        activeSubscriptions: subCount,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void updateBadges();
  }, [updateBadges]);

  // Real-time broadcast listener with audio-visual notifications
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('brokole-live-sync-channel');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'skips_updated') {
            toast.warning('⚠️ Meal Skip Updated by Customer', {
              description: 'Customer updated their meal schedule. Kitchen cooking adjusted.',
            });
          } else if (ev.data?.type === 'order_status_updated') {
            toast.info(`Status Updated: Order #${ev.data.id || ''}`, {
              description: `New status: ${ev.data.status}`,
            });
          }
          void updateBadges();
        };
      }
    } catch {}

    const handleCustom = () => {
      void updateBadges();
    };

    window.addEventListener('bkl-orders-updated', handleCustom);
    window.addEventListener('bkl-skips-updated', handleCustom);
    window.addEventListener('storage', handleCustom);

    const interval = window.setInterval(updateBadges, 2500);
    return () => {
      bc?.close();
      window.removeEventListener('bkl-orders-updated', handleCustom);
      window.removeEventListener('bkl-skips-updated', handleCustom);
      window.removeEventListener('storage', handleCustom);
      window.clearInterval(interval);
    };
  }, [updateBadges]);

  const setTab = (newTab: Tab) => {
    setTabState(newTab);
    const basePath = getBasePath();
    const targetUrl = basePath ? `${basePath}/${newTab}` : `/${newTab}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({ tab: newTab }, '', targetUrl);
    }
    const tabTitles: Record<Tab, string> = {
      orders: 'Live Orders Kitchen',
      subscriptions: 'VIP Subscriptions Hub',
      'power-bowl': 'Power Bowl Studio',
      inventory: 'Stock & Inventory',
      customers: 'Customer Directory',
      menu: 'Menu Management',
      sales: 'Sales & Analytics',
    };
    document.title = `${tabTitles[newTab] || 'Admin'} - Brokole Operations`;
  };

  useEffect(() => {
    const handlePopState = () => {
      setTabState(getTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const tabs: Array<{ id: Tab; label: string; icon: typeof ClipboardList; visible: boolean }> = [
    { id: 'orders', label: 'Orders', icon: ClipboardList, visible: true },
    { id: 'subscriptions', label: 'Subscriptions', icon: CalendarRange, visible: true },
    { id: 'power-bowl', label: 'Customize Power Bowl', icon: ChefHat, visible: true },
    { id: 'inventory', label: 'Inventory', icon: Boxes, visible: true },
    { id: 'customers', label: 'Customers', icon: Users, visible: true },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed, visible: true },
    { id: 'sales', label: 'Sales report', icon: BarChart3, visible: true },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="flex h-full flex-col">
      <Toaster position="top-right" richColors theme="light" closeButton duration={3500} />

      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-xs">
            <ShieldCheck className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Brokole Operations</div>
            <div className="text-xs text-neutral-500">
              {profile.full_name ?? profile.email} · {ROLE_LABELS[profile.role]}
            </div>
          </div>
        </div>

        <button
          onClick={session.signOut}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 cursor-pointer"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </header>

      {/* Admin Navbar with Live Capsule Notification Badges */}
      <nav className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-white px-4">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition cursor-pointer ${
              tab === id
                ? 'border-brand-600 font-bold text-brand-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>

            {/* Notification Badge on Orders Tab */}
            {id === 'orders' && stats.newOrders > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white shadow-xs animate-pulse">
                <span className="size-1.5 rounded-full bg-white animate-ping" />
                {stats.newOrders} New
              </span>
            )}

            {/* Notification Badge on Subscriptions Tab */}
            {id === 'subscriptions' && stats.skippedToday > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                ⏸️ {stats.skippedToday} Skipped
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-4">
        {visibleTabs.length === 0 && (
          <p className="text-sm text-neutral-500">
            Your role has no screens enabled yet. Ask an owner to adjust your permissions.
          </p>
        )}
        {tab === 'orders' && <OrdersScreen session={session} />}
        {tab === 'subscriptions' && <SubscriptionsScreen session={session} />}
        {tab === 'power-bowl' && <PowerBowlScreen session={session} />}
        {tab === 'inventory'     && <InventoryScreen     session={session} />}
        {tab === 'customers'     && <CustomersScreen     session={session} />}
        {tab === 'menu'   && <MenuScreen   session={session} />}
        {tab === 'sales'  && <SalesReportScreen session={session} />}
      </main>
    </div>
  );
}
