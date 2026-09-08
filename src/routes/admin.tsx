import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import AdminApp from '../../apps/admin/src/App';

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Brokole Operations & Admin Console' },
      { name: 'description', content: 'Brokole Operations, Kitchen Orders, Subscriptions & Administration Portal.' },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 antialiased">
      <AdminApp />
    </div>
  );
}
