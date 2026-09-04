import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { X, Mail, Lock, User, Phone, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { isApiConfigured } from '../lib/api';
import { toast } from 'sonner';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authMode, closeAuthModal, login, register } = useAuthStore();
  const lastError = useAuthStore((s) => s.lastError);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>(authMode || 'login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adminClickCount, setAdminClickCount] = useState(0);

  const navigate = useNavigate();

  if (!isAuthModalOpen) return null;

  // The hidden "click 10 times to reach the admin console" shortcut was removed.
  // Combined with the old blank-password check on /kitchen it was a complete
  // path from the public storefront into operations. Staff sign in at the
  // separate admin app instead.
  const handleSecretAdminClick = () => {
    setAdminClickCount(adminClickCount + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          toast.error('Enter your email and password');
          return;
        }

        const success = await login(email, password);
        if (success) {
          toast.success('Welcome back to Bro-Ko-Le!');
          return;
        }

        // Report what actually went wrong. This used to always say "Account not
        // found - please create an account first", which sent people to the
        // signup form even when the real cause was a wrong password or an
        // unconfirmed email.
        toast.error('Sign-in failed', {
          description: useAuthStore.getState().lastError ?? 'Check your email and password.',
          duration: 6000,
        });
      } else {
        if (!name.trim() || !email.trim() || !password) {
          toast.error('Please fill in your name, email and a password');
          return;
        }

        const success = await register(name, email, phone, password);
        const err = useAuthStore.getState().lastError;

        if (!success) {
          toast.error('Could not create your account', {
            description: err ?? 'Please try again.',
            duration: 6000,
          });
          return;
        }

        if (err) {
          // Signed up, but the session is pending email confirmation.
          toast.info('Almost there', { description: err, duration: 8000 });
          setMode('login');
          return;
        }

        toast.success('Account created!', { description: 'Welcome to Bro-Ko-Le.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={closeAuthModal}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 shadow-2xl z-10 carved-box animate-scale-in">

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-2xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Branding & Header */}
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Bro-Ko-Le"
            className="w-16 h-16 rounded-2xl object-cover shadow-md mx-auto mb-3 border-2 border-[var(--color-primary-light)]"
          />
          <h3 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
            {mode === 'login' ? 'Welcome Back' : 'Join Bro-Ko-Le'}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1">
            {mode === 'login'
              ? 'Sign in to access your saved macros & orders'
              : 'Create an account to start your fresh healthy meal delivery'}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex bg-[var(--color-surface-hover)] p-1 rounded-2xl border border-[var(--color-border)] mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${mode === 'login'
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${mode === 'register'
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
              Email Address / Phone Number
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.morgan@example.com"
                className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                Mobile Number (for delivery notifications)
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black text-sm hover:bg-[var(--color-primary-hover)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn mt-2"
          >
            <span>{mode === 'login' ? 'Sign In to Bro-Ko-Le' : 'Create My Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--color-border)]" />
          </div>
          <span className="relative bg-[var(--color-surface)] px-3 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            Or continue with
          </span>
        </div>

        {/* Social Login Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              login('google.user@gmail.com', '');
              toast.success('Signed in with Google!');
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-main)] hover:bg-[var(--color-surface)] transition-all cursor-pointer carved-btn"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => {
              login('apple.user@icloud.com', '');
              toast.success('Signed in with Apple!');
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-main)] hover:bg-[var(--color-surface)] transition-all cursor-pointer carved-btn"
          >
            <svg className="w-4 h-4 fill-current text-[var(--color-text-main)]" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.67-.81 1.13-1.95.99-3.09-1 .04-2.2.67-2.91 1.5-.64.74-1.2 1.91-1.05 3.03 1.12.09 2.25-.57 2.97-1.44z" />
            </svg>
            <span>Apple</span>
          </button>
        </div>

        {/* Security Note Footer (Silent Admin Trigger) */}
        <div
          onClick={handleSecretAdminClick}
          className="mt-6 pt-3 border-t border-[var(--color-border-subtle)] text-center text-[11px] text-[var(--color-text-light)] flex items-center justify-center gap-1.5 select-none cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
          <span>Secure 256-bit encrypted login</span>
        </div>

      </div>
    </div>
  );
};
