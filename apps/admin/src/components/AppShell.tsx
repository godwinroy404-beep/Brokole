import { useState } from 'react';
import { ClipboardList, UtensilsCrossed, LogOut, ShieldCheck, CalendarRange, Boxes, Users, BarChart3 } from 'lucide-react';
import { ROLE_LABELS } from '@brokole/domain';
import type { AdminSession } from '../lib/useSession';
import { OrdersScreen } from '../screens/OrdersScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { SalesReportScreen } from '../screens/SalesReportScreen';

type Tab = 'orders' | 'subscriptions' | 'inventory' | 'customers' | 'menu' | 'sales';

export function AppShell({ session }: { session: AdminSession }) {
  const [tab, setTab] = useState<Tab>('orders');
  const profile = session.profile!;

  const tabs: Array<{ id: Tab; label: string; icon: typeof ClipboardList; visible: boolean }> = [
    { id: 'orders', label: 'Orders', icon: ClipboardList, visible: session.can('orders.read.all') },
    { id: 'subscriptions', label: 'Subscriptions', icon: CalendarRange,
      visible: session.can('orders.read.all') },
    { id: 'inventory', label: 'Inventory', icon: Boxes,
      visible: session.can('inventory.read') },
    { id: 'customers', label: 'Customers', icon: Users,
      visible: session.can('customers.read') },
    { id: 'menu',   label: 'Menu',   icon: UtensilsCrossed, visible: session.can('menu.read') },
    // Revenue is finance.read: kitchen staff and riders run the board, they
    // don't see the money.
    { id: 'sales',  label: 'Sales report', icon: BarChart3, visible: session.can('finance.read') },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
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
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-neutral-200 bg-white px-4">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id} onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition ${
              tab === id
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-4">
        {visibleTabs.length === 0 && (
          <p className="text-sm text-neutral-500">
            Your role has no screens enabled yet. Ask an owner to adjust your permissions.
          </p>
        )}
        {tab === 'orders' && session.can('orders.read.all') && <OrdersScreen session={session} />}
        {tab === 'subscriptions' && session.can('orders.read.all') && <SubscriptionsScreen session={session} />}
        {tab === 'inventory'     && session.can('inventory.read')  && <InventoryScreen     session={session} />}
        {tab === 'customers'     && session.can('customers.read')  && <CustomersScreen     session={session} />}
        {tab === 'menu'   && session.can('menu.read')        && <MenuScreen   session={session} />}
        {tab === 'sales'  && session.can('finance.read')     && <SalesReportScreen session={session} />}
      </main>
    </div>
  );
}
