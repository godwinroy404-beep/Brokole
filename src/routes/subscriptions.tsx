import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionPlans } from '../components/SubscriptionPlans';

export const Route = createFileRoute('/subscriptions')({
  head: () => ({
    meta: [
      { title: 'Meal Subscriptions & Plans - Brokole' },
      { name: 'description', content: 'Weekly and monthly macro meal subscriptions available for pre-order. Save up to 25% with dietitian-customized plans.' },
    ],
  }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto">
      <SubscriptionPlans />
    </div>
  );
}
