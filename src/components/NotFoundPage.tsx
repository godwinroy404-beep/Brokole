import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void navigate({ to: '/' });
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 py-12 select-none">
      {/* 404 Header Badge */}
      <div className="mb-2">
        <span className="text-xs font-black tracking-widest text-[var(--color-primary-muted)] uppercase bg-[var(--color-primary-light)] px-3 py-1 rounded-full border border-[var(--color-border)]">
          404 — Page Not Found
        </span>
      </div>

      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--color-text-main)] tracking-tight mb-3">
        Oh noo!
      </h1>

      {/* Subtitle */}
      <p className="max-w-md text-sm sm:text-base text-[var(--color-text-muted)] font-medium leading-relaxed mb-6">
        You've caught us at a bad time. Check back in when we've got ahold of our scooter.
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-10 flex-wrap justify-center">
        {/* Go Back Button */}
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>

        {/* Go to Home Button */}
        <Link
          to="/"
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Go to Home</span>
        </Link>
      </div>

      {/* Scooter Giraffe Line Art Illustration */}
      <div className="w-full max-w-lg mx-auto overflow-hidden">
        <img
          src="/images/404-scooter.png"
          alt="Scooter Broccoli 404 Illustration"
          className="w-full h-auto object-contain max-h-[380px] filter drop-shadow-xs"
        />
      </div>
    </div>
  );
};
