import { useState } from 'react';
import {
  ClipboardList, UtensilsCrossed, Boxes, Users, TrendingUp,
  LogOut, ShieldCheck, Sparkles
} from 'lucide-react';
import { ROLE_LABELS } from '@brokole/domain';
import type { AdminSession } from '../lib/useSession';
import { OrdersScreen } from '../screens/OrdersScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { SalesReportScreen } from '../screens/SalesReportScreen';

type Tab = 'orders' | 'menu' | 'inventory' | 'customers' | 'finance';

export function AppShell({ session }: { session: AdminSession }) {
  const [tab, setTab] = useState<Tab>('orders');
  const profile = session.profile!;

  const tabs: Array<{ id: Tab; label: string; icon: typeof ClipboardList; visible: boolean }> = [
    { id: 'orders', label: 'Live Orders', icon: ClipboardList, visible: session.can('orders.read.all') },
    { id: 'menu', label: 'Menu Catalog', icon: UtensilsCrossed, visible: session.can('menu.read') },
    { id: 'inventory', label: 'Inventory', icon: Boxes, visible: session.can('inventory.read') },
    { id: 'customers', label: 'Customers', icon: Users, visible: session.can('customers.read') },
    { id: 'finance', label: 'Sales Report', icon: TrendingUp, visible: session.can('finance.read') },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-xs">
            <ShieldCheck className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-900">Brokole Operations</span>
              {session.isDemoMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <Sparkles className="size-3" /> Owner Console
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 font-medium">
              {profile.full_name ?? profile.email} · {ROLE_LABELS[profile.role]}
            </div>
          </div>
        </div>

        <button
          onClick={session.signOut}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900 shadow-2xs"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </header>

      <nav className="flex gap-1 border-b border-neutral-200 bg-white px-4 overflow-x-auto">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id} onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition whitespace-nowrap ${tab === id
                ? 'border-brand-600 font-bold text-brand-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {visibleTabs.length === 0 && (
          <p className="text-sm text-neutral-500">
            Your role has no screens enabled yet. Ask an owner to adjust your permissions.
          </p>
        )}
        {tab === 'orders' && session.can('orders.read.all') && <OrdersScreen session={session} />}
        {tab === 'menu' && session.can('menu.read') && <MenuScreen session={session} />}
        {tab === 'inventory' && session.can('inventory.read') && <InventoryScreen session={session} />}
        {tab === 'customers' && session.can('customers.read') && <CustomersScreen session={session} />}
        {tab === 'finance' && session.can('finance.read') && <SalesReportScreen session={session} />}
      </main>
    </div>
  );
}
