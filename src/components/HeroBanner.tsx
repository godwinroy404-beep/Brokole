import React, { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { ShieldCheck, Flame, ArrowRight, UtensilsCrossed, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

const HERO_SLIDES = [
  { url: '/images/hero_bowl.png', title: 'Chef Macro Power Bowl', tag: '45g Protein • 480 kcal' },
  { url: '/images/mediterranean_chicken.png', title: 'Mediterranean Chicken Bowl', tag: '42g Protein • 510 kcal' },
  { url: '/images/hummus_bowl.png', title: 'Hummus & Chicken Bowl', tag: '38g Protein • 440 kcal' },
  { url: '/images/protein_pancakes.png', title: 'Protein Oats & Honey Pancakes', tag: '28g Protein • 380 kcal' },
  { url: '/images/mix_fruit_bowl.png', title: 'Fresh Mix Cut Fruit Bowl', tag: '100% Fresh • ₹85' },
  { url: '/images/grilled_chicken_caesar.png', title: 'Grilled Chicken Caesar Salad', tag: '36g Protein • 390 kcal' },
];

export const HeroBanner: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] mx-4 sm:mx-6 lg:mx-8 my-4 shadow-card carved-box flex flex-col md:flex-row min-h-[380px]">
      {/* Decorative background glow blur */}
      <div className="absolute -top-12 -right-12 w-80 h-80 rounded-full bg-[var(--color-primary-muted)] opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-[var(--color-accent-glow)] opacity-20 blur-3xl pointer-events-none" />

      {/* Left Column: Text & CTAs */}
      <div className="relative z-10 w-full md:w-7/12 lg:w-7/12 p-6 sm:p-10 lg:p-12 flex flex-col justify-center space-y-4">

        {/* Headline */}
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
          Macro-balanced meals <br className="hidden sm:inline" />
          <span className="text-[var(--color-accent)]">Pre-Order Fresh Healthy Meals</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed max-w-lg">
          Fuel your fitness goals with targeted high-protein, calorie-controlled meals. Every dish features verified nutrition facts & premium organic ingredients.
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-emerald-100 font-semibold">
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-xs px-3 py-1.5 rounded-2xl border border-white/10">
            <Flame className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>High Protein</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-xs px-3 py-1.5 rounded-2xl border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>100% Clean</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-xs px-3 py-1.5 rounded-2xl border border-white/10">
            <UtensilsCrossed className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Zero Preservatives</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 pt-2">
          <a
            href="#menu-section"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[var(--color-accent)] text-[var(--color-text-on-accent)] font-extrabold text-sm hover:bg-[var(--color-accent-hover)] transition-all shadow-md cursor-pointer hover:gap-3 carved-btn"
          >
            <span>Pre-Order Fresh Meal</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <Link
            to="/my-macros"
            className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm transition-all border border-white/20 carved-btn"
          >
            <span>Track My Macros</span>
          </Link>
        </div>
      </div>

      {/* Right Column: Auto-Scrolling Image Carousel */}
      <div className="relative w-full h-72 md:h-auto md:absolute md:top-0 md:bottom-0 md:right-0 md:w-5/12 lg:w-1/2 overflow-hidden group">
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${isActive ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105 pointer-events-none'
                }`}
            >
              <img
                src={slide.url}
                alt={slide.title}
                className="w-full h-full object-cover object-center"
              />

              {/* Gradient Overlay for Text Readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)]/40 to-transparent hidden md:block" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-primary)] via-transparent to-transparent md:hidden" />

              {/* Dish Name & Tag Overlay Badge */}
              <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-2xl bg-black/65 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/10">
                <span>{slide.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-on-accent)] font-black">
                  {slide.tag}
                </span>
              </div>
            </div>
          );
        })}

        {/* Carousel Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs border border-white/20 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={handleNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs border border-white/20 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

      </div>

    </div>
  );
};
