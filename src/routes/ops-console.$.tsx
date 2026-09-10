import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import AdminApp from '../../apps/admin/src/App';

export const Route = createFileRoute('/ops-console/$')({
  head: () => ({
    meta: [
      { title: 'Brokole Operations & Staff Console' },
      { name: 'description', content: 'Restricted Staff & Kitchen Operations Portal.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: OpsConsolePage,
});

function OpsConsolePage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 antialiased">
      <AdminApp />
    </div>
  );
}
