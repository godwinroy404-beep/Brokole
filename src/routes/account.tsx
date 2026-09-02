import React, { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { User, MapPin, Heart, Check, LogOut, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';

const DEMO_PROFILES_LIST = [
  {
    id: 'user_101',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    phone: '+91 98765 43210',
    address: '42 Park Avenue, Koramangala 5th Block, Bengaluru, 560095',
    dietaryPreferences: ['High Protein', 'Gluten Free'],
  },
  {
    id: 'user_102',
    name: 'Priya Sharma',
    email: 'priya.s@healthlife.org',
    phone: '+91 98123 76543',
    address: '88 Indiranagar 100ft Road, Bengaluru, 560038',
    dietaryPreferences: ['Low Carb', 'Vegan'],
  },
  {
    id: 'user_103',
    name: 'Rohan Verma',
    email: 'rohan.v@techstudio.io',
    phone: '+91 97654 32109',
    address: '15 HSR Layout Sector 1, Bengaluru, 560102',
    dietaryPreferences: ['High Protein', 'Keto Friendly'],
  },
  {
    id: 'user_104',
    name: 'Deepak Kumar',
    email: 'deepak.kumar@example.com',
    phone: '+91 98765 12345',
    address: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru, 560103',
    dietaryPreferences: ['High Protein'],
  },
];

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: 'My Account — Bro-Ko-Le' },
      { name: 'description', content: 'Manage your Bro-Ko-Le account, delivery addresses, and dietary preferences.' },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, isLoggedIn, logout, updateUser, openAuthModal, switchProfile } = useAuthStore();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [dietary, setDietary] = useState<string[]>(user?.dietaryPreferences || ['High Protein']);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone);
      setAddress(user.address);
      setDietary(user.dietaryPreferences || []);
    }
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name, email, phone, address, dietaryPreferences: dietary });
    toast.success('Account preferences saved successfully!');
  };

  const toggleDiet = (pref: string) => {
    if (dietary.includes(pref)) {
      setDietary(dietary.filter((d) => d !== pref));
    } else {
      setDietary([...dietary, pref]);
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('Logged out of Bro-Ko-Le');
    navigate({ to: '/' });
  };

  if (!isLoggedIn || !user) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-lg mx-auto text-center space-y-6">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 shadow-card carved-box space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-xs">
            <User className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
              Sign In to Bro-Ko-Le
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1 leading-relaxed">
              Access your personalized macro goals, saved delivery addresses, and track active pre-orders.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => openAuthModal('login')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black text-sm hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
            >
              <span>Sign In with Email or Phone</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => openAuthModal('register')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-main)] font-extrabold text-sm hover:bg-[var(--color-surface)] transition-all cursor-pointer carved-btn"
            >
              Create New Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] text-[var(--color-accent)] flex items-center justify-center font-black text-lg shadow-xs">
            {user.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
              {user.name}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] font-semibold">
              {user.email} • {user.phone}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-red-50 text-[var(--color-error)] text-xs font-extrabold hover:bg-red-100 transition-all cursor-pointer carved-btn border border-red-200"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>

      {/* DEMO MULTI-PROFILE SWITCHER CARD */}
      <div className="bg-[var(--color-primary-light)] border border-[var(--color-border)] rounded-3xl p-5 shadow-xs space-y-3 carved-box">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Switch Profile to Test Live Order Status Tracker</span>
          </h2>
          <span className="text-[10px] text-[var(--color-text-muted)] font-bold">1-Click Switch</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DEMO_PROFILES_LIST.map((prof) => {
            const isCurrent = user.email.toLowerCase() === prof.email.toLowerCase();
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => {
                  switchProfile(prof);
                  toast.success(`Switched to profile: ${prof.name}`);
                }}
                className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer border carved-btn ${isCurrent
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-main)] border-[var(--color-border)] hover:border-[var(--color-primary-muted)]'
                  }`}
              >
                <span className="block font-extrabold text-xs truncate">{prof.name}</span>
                <span className="block text-[10px] opacity-80 truncate">{prof.email.split('@')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Details */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs space-y-4 carved-box">
          <h2 className="text-base font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Personal Information</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Mobile Number (for pre-order delivery updates)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
            />
          </div>
        </div>

        {/* Saved Address */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs space-y-3 carved-box">
          <h2 className="text-base font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Primary Delivery Address</span>
          </h2>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-medium text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
          />
        </div>

        {/* Dietary Preferences */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs space-y-3 carved-box">
          <h2 className="text-base font-extrabold text-[var(--color-text-main)] flex items-center gap-2">
            <Heart className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Dietary Preferences</span>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {['High Protein', 'Low Carb', 'Keto Friendly', 'Gluten Free', 'Dairy Free', 'Vegan', 'Nut Free'].map((pref) => {
              const isSelected = dietary.includes(pref);
              return (
                <button
                  key={pref}
                  type="button"
                  onClick={() => toggleDiet(pref)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border carved-btn ${isSelected
                      ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)]'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                    }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
                  <span>{pref}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-extrabold text-sm hover:bg-[var(--color-primary-hover)] transition-all shadow-md cursor-pointer carved-btn"
        >
          Save Profile Preferences
        </button>
      </form>
    </div>
  );
}
