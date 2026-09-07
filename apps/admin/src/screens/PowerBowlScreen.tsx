import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChefHat, Plus, Search, Check, Flame, Sparkles, AlertTriangle, ShieldCheck,
  Edit, Trash2, RotateCcw, DollarSign, Layers, Tag, Eye, EyeOff, Save, X, Utensils,
  Upload, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@brokole/domain';
import type { AdminSession } from '../lib/useSession';

export interface PowerBowlIngredient {
  id: string;
  name: string;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: 'base' | 'protein' | 'veggies' | 'sauce' | 'toppings';
  tag?: string;
  imageUrl: string;
  inStock: boolean;
}

function processUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 350;
        const MAX_HEIGHT = 350;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Could not parse image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

const INITIAL_INGREDIENTS: PowerBowlIngredient[] = [
  // Bases
  { id: 'base-1', name: 'Fluffy Organic Quinoa', price: 40, calories: 140, protein: 5, carbs: 25, fat: 2, category: 'base', tag: 'High Fiber', imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'base-2', name: 'Brown Jasmine Rice', price: 35, calories: 160, protein: 4, carbs: 34, fat: 1, category: 'base', imageUrl: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'base-3', name: 'Cauli-Rice (Keto)', price: 45, calories: 35, protein: 2, carbs: 5, fat: 0, category: 'base', tag: 'Low Carb', imageUrl: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'base-4', name: 'Mixed Baby Greens & Spinach', price: 35, calories: 25, protein: 2, carbs: 3, fat: 0, category: 'base', tag: 'Vegan', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80', inStock: true },

  // Proteins
  { id: 'prot-1', name: 'Herb-Marinated Grilled Chicken', price: 75, calories: 220, protein: 42, carbs: 0, fat: 4, category: 'protein', tag: '42g Protein', imageUrl: '/images/grilled_chicken_bowl.png', inStock: true },
  { id: 'prot-2', name: 'Tandoori Spiced Paneer Cubes', price: 65, calories: 260, protein: 26, carbs: 4, fat: 16, category: 'protein', tag: 'Vegetarian', imageUrl: '/images/paneer_tikka_salad.png', inStock: true },
  { id: 'prot-3', name: 'Seared Norwegian Salmon Fillet', price: 85, calories: 240, protein: 34, carbs: 0, fat: 12, category: 'protein', tag: 'Omega-3', imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'prot-4', name: 'Crispy Air-Fried Tofu Cubes', price: 55, calories: 150, protein: 18, carbs: 3, fat: 8, category: 'protein', tag: 'Vegan', imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80', inStock: true },

  // Veggies & Mix-ins
  { id: 'veg-1', name: 'Steamed Broccoli Florets', price: 15, calories: 30, protein: 2, carbs: 5, fat: 0, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'veg-2', name: 'Roasted Sweet Potato Wedges', price: 20, calories: 90, protein: 1, carbs: 20, fat: 0, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'veg-3', name: 'Fresh Hass Avocado Slices', price: 25, calories: 120, protein: 1, carbs: 6, fat: 11, category: 'veggies', tag: 'Healthy Fats', imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'veg-4', name: 'Charred Sweet Corn & Black Beans', price: 15, calories: 60, protein: 3, carbs: 12, fat: 1, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'veg-5', name: 'Cherry Tomatoes & Cucumber', price: 12, calories: 20, protein: 1, carbs: 4, fat: 0, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb1b7a5?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'veg-6', name: 'Edamame Beans', price: 20, calories: 70, protein: 6, carbs: 5, fat: 3, category: 'veggies', imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=200&q=80', inStock: true },

  // Sauces
  { id: 'sauce-1', name: 'Lemon Tahini Cream', price: 12, calories: 50, protein: 2, carbs: 3, fat: 4, category: 'sauce', imageUrl: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'sauce-2', name: 'Mint Yogurt Herb Dressing', price: 10, calories: 35, protein: 2, carbs: 2, fat: 2, category: 'sauce', imageUrl: 'https://images.unsplash.com/photo-1571217698542-a7d036136be9?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'sauce-3', name: 'Creamy Avocado Cilantro', price: 15, calories: 65, protein: 1, carbs: 3, fat: 6, category: 'sauce', imageUrl: '/images/green_detox_smoothie.png', inStock: true },
  { id: 'sauce-4', name: 'Chipotle Lime Vinaigrette', price: 12, calories: 45, protein: 0, carbs: 3, fat: 4, category: 'sauce', imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=200&q=80', inStock: true },

  // Toppings
  { id: 'top-1', name: 'Toasted Pumpkin & Chia Seeds', price: 12, calories: 45, protein: 2, carbs: 2, fat: 3.5, category: 'toppings', imageUrl: '/images/roasted_trail_mix.png', inStock: true },
  { id: 'top-2', name: 'Roasted Almond Flakes', price: 15, calories: 55, protein: 2, carbs: 2, fat: 4.5, category: 'toppings', imageUrl: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=200&q=80', inStock: true },
  { id: 'top-3', name: 'Crispy Chicken Crunch', price: 15, calories: 50, protein: 6, carbs: 2, fat: 2, category: 'toppings', imageUrl: '/images/grilled_chicken_wrap.png', inStock: true },
  { id: 'top-4', name: 'Fresh Microgreens & Sesame', price: 10, calories: 10, protein: 1, carbs: 1, fat: 0, category: 'toppings', imageUrl: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=200&q=80', inStock: true },
];

const PRESET_INGREDIENT_IMAGES = [
  { label: 'Organic Quinoa', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80' },
  { label: 'Brown Jasmine Rice', url: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=300&q=80' },
  { label: 'Cauli-Rice (Keto)', url: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=300&q=80' },
  { label: 'Baby Greens & Spinach', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=300&q=80' },
  { label: 'Herb Grilled Chicken', url: '/images/grilled_chicken_bowl.png' },
  { label: 'Tandoori Paneer Cubes', url: '/images/paneer_tikka_salad.png' },
  { label: 'Seared Salmon Fillet', url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=300&q=80' },
  { label: 'Air-Fried Tofu Cubes', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80' },
  { label: 'Steamed Broccoli', url: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=300&q=80' },
  { label: 'Roasted Sweet Potato', url: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=300&q=80' },
  { label: 'Fresh Avocado Slices', url: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=300&q=80' },
  { label: 'Sweet Corn & Black Beans', url: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=300&q=80' },
  { label: 'Cherry Tomatoes & Cucumber', url: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb1b7a5?auto=format&fit=crop&w=300&q=80' },
  { label: 'Edamame Beans', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80' },
  { label: 'Lemon Tahini Cream', url: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=300&q=80' },
  { label: 'Mint Yogurt Dressing', url: 'https://images.unsplash.com/photo-1571217698542-a7d036136be9?auto=format&fit=crop&w=300&q=80' },
  { label: 'Avocado Cilantro Sauce', url: '/images/green_detox_smoothie.png' },
  { label: 'Chipotle Vinaigrette', url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=300&q=80' },
  { label: 'Pumpkin & Chia Seeds', url: '/images/roasted_trail_mix.png' },
  { label: 'Roasted Almond Flakes', url: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=300&q=80' },
  { label: 'Crispy Chicken Crunch', url: '/images/grilled_chicken_wrap.png' },
  { label: 'Microgreens & Sesame', url: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=300&q=80' },
];

const POWER_BOWL_STORAGE_KEY = 'brokole-power-bowl-ingredients';

function loadPowerBowlIngredients(): PowerBowlIngredient[] {
  try {
    const raw = localStorage.getItem(POWER_BOWL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    /* fallback to defaults */
  }
  return INITIAL_INGREDIENTS;
}

function savePowerBowlIngredients(list: PowerBowlIngredient[]) {
  try {
    localStorage.setItem(POWER_BOWL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Storage warning when saving Power Bowl ingredients:', e);
  }

  // Sync to local dev server file so storefront on port 5174 gets instant updates
  const endpoints = ['/api/local-power-bowl-sync', 'http://localhost:5174/api/local-power-bowl-sync'];
  for (const ep of endpoints) {
    try {
      void fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: list }),
      });
    } catch {
      /* ignore offline errors */
    }
  }
}

export function PowerBowlScreen({ session }: { session: AdminSession }) {
  const [ingredients, setIngredients] = useState<PowerBowlIngredient[]>(() => loadPowerBowlIngredients());
  const [activeCategory, setActiveCategory] = useState<'all' | 'base' | 'protein' | 'veggies' | 'sauce' | 'toppings'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minVeggieRequirement, setMinVeggieRequirement] = useState(3);

  // Sync with shared file on mount
  useEffect(() => {
    const fetchSynced = async () => {
      const endpoints = ['/api/local-power-bowl-sync', 'http://localhost:5174/api/local-power-bowl-sync'];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
              setIngredients(data.ingredients);
              try {
                localStorage.setItem(POWER_BOWL_STORAGE_KEY, JSON.stringify(data.ingredients));
              } catch {}
              break;
            }
          }
        } catch {
          /* ignore fetch error */
        }
      }
    };
    void fetchSynced();
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PowerBowlIngredient | null>(null);
  const [imageMode, setImageMode] = useState<'upload' | 'preset' | 'url'>('upload');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    setIsUploadingImage(true);
    try {
      const processedDataUrl = await processUploadedImage(file);
      setFormData((prev) => ({ ...prev, imageUrl: processedDataUrl }));
      toast.success(`Uploaded image "${file.name}"!`);
    } catch {
      toast.error('Failed to process image file');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    category: 'base' as PowerBowlIngredient['category'],
    tag: '',
    imageUrl: '',
    inStock: true,
  });

  const categoryCounts = useMemo(() => {
    return {
      all: ingredients.length,
      base: ingredients.filter((i) => i.category === 'base').length,
      protein: ingredients.filter((i) => i.category === 'protein').length,
      veggies: ingredients.filter((i) => i.category === 'veggies').length,
      sauce: ingredients.filter((i) => i.category === 'sauce').length,
      toppings: ingredients.filter((i) => i.category === 'toppings').length,
    };
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.tag && item.tag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [ingredients, activeCategory, searchQuery]);

  const toggleStockStatus = (id: string) => {
    setIngredients((prev) => {
      const next = prev.map((item) => {
        if (item.id === id) {
          const nextStock = !item.inStock;
          toast.success(`Updated "${item.name}" availability to ${nextStock ? 'In Stock' : 'Out of Stock'}`);
          return { ...item, inStock: nextStock };
        }
        return item;
      });
      savePowerBowlIngredients(next);
      return next;
    });
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      price: '20',
      calories: '50',
      protein: '2',
      carbs: '4',
      fat: '1',
      category: activeCategory === 'all' ? 'base' : activeCategory,
      tag: '',
      imageUrl: '/images/hero_bowl.png',
      inStock: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: PowerBowlIngredient) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: String(item.price),
      calories: String(item.calories),
      protein: String(item.protein),
      carbs: String(item.carbs),
      fat: String(item.fat),
      category: item.category,
      tag: item.tag || '',
      imageUrl: item.imageUrl,
      inStock: item.inStock,
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = (id: string, name: string) => {
    setIngredients((prev) => {
      const next = prev.filter((item) => item.id !== id);
      savePowerBowlIngredients(next);
      return next;
    });
    toast.success(`Removed "${name}" from Power Bowl Studio`);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Ingredient name is required');
      return;
    }

    const priceNum = Number(formData.price) || 0;
    const caloriesNum = Number(formData.calories) || 0;
    const proteinNum = Number(formData.protein) || 0;
    const carbsNum = Number(formData.carbs) || 0;
    const fatNum = Number(formData.fat) || 0;

    let updatedList: PowerBowlIngredient[] = [];

    if (editingItem) {
      updatedList = ingredients.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              name: formData.name.trim(),
              price: priceNum,
              calories: caloriesNum,
              protein: proteinNum,
              carbs: carbsNum,
              fat: fatNum,
              category: formData.category,
              tag: formData.tag.trim() || undefined,
              imageUrl: formData.imageUrl.trim() || '/images/hero_bowl.png',
              inStock: formData.inStock,
            }
          : item
      );
      toast.success(`Updated ingredient "${formData.name.trim()}"`);
    } else {
      const newItem: PowerBowlIngredient = {
        id: `ing-${Date.now()}`,
        name: formData.name.trim(),
        price: priceNum,
        calories: caloriesNum,
        protein: proteinNum,
        carbs: carbsNum,
        fat: fatNum,
        category: formData.category,
        tag: formData.tag.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || '/images/hero_bowl.png',
        inStock: formData.inStock,
      };
      updatedList = [newItem, ...ingredients];
      toast.success(`Added "${formData.name.trim()}" to Power Bowl Studio`);
    }

    setIngredients(updatedList);
    savePowerBowlIngredients(updatedList);
    setIsModalOpen(false);
  };

  const categoryLabels: Record<PowerBowlIngredient['category'], string> = {
    base: 'Base',
    protein: 'Protein',
    veggies: 'Veggie / Mix-in',
    sauce: 'House Dressing',
    toppings: 'Crunchy Topping',
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-emerald-950 p-6 text-white shadow-xl border border-emerald-800/80">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <ChefHat className="size-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Customize Your Power Bowl Studio
              </h1>
              <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold mt-0.5">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>Backend Menu Management Console • DIY Studio Configurator</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-emerald-200/90 leading-relaxed max-w-2xl">
            Configure available bases, high-protein portions, mix-ins, house dressings, crunchy toppings, prices & macro profiles for the customer-facing DIY Power Bowl builder.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          disabled={!session.can('menu.write')}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-emerald-950 hover:bg-emerald-400 active:scale-95 transition cursor-pointer shadow-lg shrink-0 disabled:opacity-50"
        >
          <Plus className="size-4 stroke-[3]" />
          <span>Add Power Bowl Ingredient</span>
        </button>
      </div>

      {/* KPI Stats & Rule Setting Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Total Active Options</span>
          <span className="text-xl font-black text-neutral-900 block">{ingredients.length} Ingredients</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Protein Options</span>
          <span className="text-xl font-black text-emerald-600 block">{categoryCounts.protein} High-Grade Options</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Min Mix-Ins Rule</span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-sm font-black text-amber-600">Minimum {minVeggieRequirement} Veggies</span>
            <button
              onClick={() => {
                const next = minVeggieRequirement === 3 ? 2 : 3;
                setMinVeggieRequirement(next);
                toast.success(`Updated minimum veggie mix-ins rule to ${next} items`);
              }}
              className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 transition"
            >
              Toggle Rule
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">DIY Studio Status</span>
          <span className="text-xl font-black text-emerald-700 flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Live & Operational
          </span>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200 shadow-2xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: `All (${categoryCounts.all})` },
            { id: 'base', label: `Bases (${categoryCounts.base})` },
            { id: 'protein', label: `Proteins (${categoryCounts.protein})` },
            { id: 'veggies', label: `Veggies & Mix-ins (${categoryCounts.veggies})` },
            { id: 'sauce', label: `Dressings (${categoryCounts.sauce})` },
            { id: 'toppings', label: `Toppings (${categoryCounts.toppings})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ingredient, tag..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
          />
        </div>
      </div>

      {/* Ingredients Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredIngredients.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-neutral-200 p-8 space-y-2">
            <Utensils className="size-8 text-neutral-400 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-800">No Power Bowl ingredients found</h3>
            <p className="text-xs text-neutral-500">Try switching category tabs or clearing your search filter.</p>
          </div>
        ) : (
          filteredIngredients.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all space-y-3 relative flex flex-col justify-between ${
                item.inStock
                  ? 'border-neutral-200 hover:border-emerald-500'
                  : 'border-neutral-300 bg-neutral-50/70 opacity-75'
              }`}
            >
              <div>
                {/* Top Row: Thumbnail + Category Badge + Stock Toggle */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="size-12 rounded-xl object-cover border border-neutral-200 bg-neutral-100 shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/hero_bowl.png';
                      }}
                    />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md inline-block">
                        {categoryLabels[item.category]}
                      </span>
                      {item.tag && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded-md ml-1 inline-block">
                          {item.tag}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleStockStatus(item.id)}
                    title={item.inStock ? 'Mark Out of Stock' : 'Mark In Stock'}
                    className={`p-1.5 rounded-xl border transition cursor-pointer ${
                      item.inStock
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    {item.inStock ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                </div>

                {/* Ingredient Title & Price */}
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-neutral-900 leading-snug">{item.name}</h3>
                  <div className="text-xs font-black text-emerald-700">
                    +{formatINR(item.price)}
                  </div>
                </div>

                {/* Macro Profile Pills */}
                <div className="grid grid-cols-4 gap-1 pt-2.5 text-center text-[10px] font-bold">
                  <div className="bg-neutral-100 p-1.5 rounded-lg">
                    <span className="block font-black text-neutral-900">{item.calories}</span>
                    <span className="text-[9px] text-neutral-500 uppercase">kcal</span>
                  </div>
                  <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-200/60">
                    <span className="block font-black text-emerald-800">{item.protein}g</span>
                    <span className="text-[9px] text-emerald-600 uppercase">Prot</span>
                  </div>
                  <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-200/60">
                    <span className="block font-black text-amber-900">{item.carbs}g</span>
                    <span className="text-[9px] text-amber-700 uppercase">Carb</span>
                  </div>
                  <div className="bg-orange-50 p-1.5 rounded-lg border border-orange-200/60">
                    <span className="block font-black text-orange-900">{item.fat}g</span>
                    <span className="text-[9px] text-orange-700 uppercase">Fat</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                <span className={`text-[10px] font-extrabold ${item.inStock ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {item.inStock ? '● Active In Stock' : '○ Out of Stock'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    disabled={!session.can('menu.write')}
                    className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition cursor-pointer disabled:opacity-50"
                    title="Edit Ingredient Details"
                  >
                    <Edit className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id, item.name)}
                    disabled={!session.can('menu.write')}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer disabled:opacity-50"
                    title="Delete Ingredient"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Ingredient Modal */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-neutral-200 animate-scale-in cursor-default max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <ChefHat className="size-5 text-emerald-600" />
                <h3 className="text-base font-black text-neutral-900">
                  {editingItem ? `Edit "${editingItem.name}"` : 'Add New Power Bowl Ingredient'}
                </h3>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-neutral-700 font-bold mb-1">
                    Ingredient Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Organic Black Rice"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold cursor-pointer"
                  >
                    <option value="base">Base</option>
                    <option value="protein">Protein Portion</option>
                    <option value="veggies">Veggie / Mix-in</option>
                    <option value="sauce">House Dressing</option>
                    <option value="toppings">Crunchy Topping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-700 font-bold mb-1">Add-on Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="35"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-black text-emerald-700"
                  />
                </div>
              </div>

              {/* Macros Breakdown Grid */}
              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80 space-y-2">
                <span className="block text-neutral-700 font-extrabold text-[11px] uppercase tracking-wider">
                  Nutritional Macro Profile (per serving)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-neutral-500 font-bold mb-0.5">Calories</label>
                    <input
                      type="number"
                      value={formData.calories}
                      onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                      placeholder="140"
                      className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-white font-black text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-emerald-700 font-bold mb-0.5">Protein (g)</label>
                    <input
                      type="number"
                      value={formData.protein}
                      onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                      placeholder="25"
                      className="w-full px-2 py-1.5 rounded-lg border border-emerald-200 bg-white font-black text-center text-xs text-emerald-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-amber-700 font-bold mb-0.5">Carbs (g)</label>
                    <input
                      type="number"
                      value={formData.carbs}
                      onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                      placeholder="15"
                      className="w-full px-2 py-1.5 rounded-lg border border-amber-200 bg-white font-black text-center text-xs text-amber-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-orange-700 font-bold mb-0.5">Fat (g)</label>
                    <input
                      type="number"
                      value={formData.fat}
                      onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                      placeholder="4"
                      className="w-full px-2 py-1.5 rounded-lg border border-orange-200 bg-white font-black text-center text-xs text-orange-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-neutral-700 font-bold mb-1">High-Light Tag (Optional)</label>
                <input
                  type="text"
                  value={formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="e.g. High Protein, Keto, Vegan, Omega-3"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                />
              </div>

              {/* Ingredient Image Selection with Tabs & File Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-neutral-700 font-bold text-xs">
                    Ingredient Image
                  </label>

                  {/* Mode Selector Tabs */}
                  <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setImageMode('upload')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        imageMode === 'upload'
                          ? 'bg-white text-emerald-950 shadow-2xs font-black'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      <Upload className="inline size-3 mr-1" />
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('preset')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        imageMode === 'preset'
                          ? 'bg-white text-emerald-950 shadow-2xs font-black'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      <Utensils className="inline size-3 mr-1" />
                      Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('url')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        imageMode === 'url'
                          ? 'bg-white text-emerald-950 shadow-2xs font-black'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      URL
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Mode 1: Drag-and-Drop & File Browser Upload Zone */}
                {imageMode === 'upload' && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const file = e.dataTransfer.files[0];
                        if (file.type.startsWith('image/')) {
                          setIsUploadingImage(true);
                          processUploadedImage(file)
                            .then((url) => {
                              setFormData((prev) => ({ ...prev, imageUrl: url }));
                              toast.success(`Uploaded image "${file.name}"!`);
                            })
                            .catch(() => toast.error('Failed to process image file'))
                            .finally(() => setIsUploadingImage(false));
                        } else {
                          toast.error('Please select an image file');
                        }
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed p-4 rounded-2xl text-center cursor-pointer transition space-y-2 group ${
                      isDragOver
                        ? 'border-emerald-500 bg-emerald-100/60'
                        : 'border-emerald-300/80 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80'
                    }`}
                  >
                    {isUploadingImage ? (
                      <div className="flex flex-col items-center gap-1.5 py-2 text-emerald-700 font-extrabold">
                        <span className="size-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        <span>Processing & optimizing image...</span>
                      </div>
                    ) : formData.imageUrl ? (
                      <div className="flex items-center gap-4 text-left">
                        <img
                          src={formData.imageUrl}
                          alt="Ingredient preview"
                          className="size-14 object-cover rounded-xl border border-neutral-200 shadow-2xs shrink-0 bg-white"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/images/hero_bowl.png';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-black text-emerald-900 block truncate">
                            Image Attached Successfully!
                          </span>
                          <span className="text-[11px] text-neutral-500 font-medium block truncate">
                            Click or drag a file to replace
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData((prev) => ({ ...prev, imageUrl: '' }));
                          }}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition shrink-0"
                          title="Remove Image"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 py-1">
                        <div className="p-2.5 rounded-full bg-emerald-100 text-emerald-700 group-hover:scale-110 transition">
                          <Upload className="size-5" />
                        </div>
                        <div>
                          <span className="font-extrabold text-emerald-950 block text-xs">
                            Click to upload image file from computer
                          </span>
                          <span className="text-[11px] text-neutral-500 font-medium">
                            Or drag & drop PNG, JPG, WebP image here
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 2: Preset Food Photo Library */}
                {imageMode === 'preset' && (
                  <div className="space-y-2">
                    <select
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold bg-white cursor-pointer"
                    >
                      <option value="">Select a built-in food photo...</option>
                      {PRESET_INGREDIENT_IMAGES.map((preset) => (
                        <option key={preset.url} value={preset.url}>
                          {preset.label}
                        </option>
                      ))}
                    </select>

                    {formData.imageUrl && (
                      <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-xl border border-neutral-200">
                        <img
                          src={formData.imageUrl}
                          alt="Preset preview"
                          className="size-12 object-cover rounded-lg border border-neutral-200 shrink-0 bg-white"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/images/hero_bowl.png';
                          }}
                        />
                        <div className="text-xs">
                          <span className="font-extrabold text-neutral-800 block">Selected Preset:</span>
                          <span className="font-mono text-[11px] text-neutral-500 truncate block max-w-xs">{formData.imageUrl}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 3: Direct Web URL Input */}
                {imageMode === 'url' && (
                  <div className="space-y-2">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold bg-white"
                    />
                    {formData.imageUrl && (
                      <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-xl border border-neutral-200">
                        <img
                          src={formData.imageUrl}
                          alt="URL preview"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/images/hero_bowl.png';
                          }}
                          className="size-12 object-cover rounded-lg border border-neutral-200 shrink-0 bg-white"
                        />
                        <span className="text-[11px] font-medium text-neutral-600 truncate">
                          {formData.imageUrl}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="inStockCheck"
                  checked={formData.inStock}
                  onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
                  className="size-4 accent-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="inStockCheck" className="text-neutral-800 font-bold cursor-pointer">
                  In Stock & Available for DIY Power Bowls
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-extrabold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition shadow-md cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Create Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
