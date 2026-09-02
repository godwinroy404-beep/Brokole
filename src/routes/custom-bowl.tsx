import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { BowlBuilder } from '../components/BowlBuilder';

export const Route = createFileRoute('/custom-bowl')({
  head: () => ({
    meta: [
      { title: 'Customize Your Power Bowl — Bro-Ko-Le' },
      { name: 'description', content: 'Build your custom high-protein macro bowl with organic quinoa, grilled chicken, salmon, fresh veggies, and house dressings.' },
    ],
  }),
  component: CustomBowlPage,
});

function CustomBowlPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto">
      <BowlBuilder />
    </div>
  );
}
