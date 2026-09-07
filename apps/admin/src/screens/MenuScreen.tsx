import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Loader2, AlertTriangle, Plus, Search, X, Utensils, CheckCircle2,
  Sparkles, DollarSign, Flame, Filter, Image as ImageIcon, Clock, ShieldCheck, Tag,
  Upload, Link, FileImage, Trash2, Camera, AlertCircle, Ban, Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR, macrosLookPlausible } from '@brokole/domain';
import { api, isApiConfigured } from '../lib/api';
import type { AdminSession } from '../lib/useSession';

interface Row {
  id: string;
  name: string;
  slug: string;
  price: string | number;
  is_active: number | boolean;   // MySQL returns TINYINT(1)
  is_available?: number | boolean;
  is_popular: number | boolean;
  category_name: string | null;
  category_id?: string | null;
  description?: string | null;
  image_url?: string | null;
  prep_time?: string | null;
  calories: string | number | null;
  protein_g: string | number | null;
  carbs_g: string | number | null;
  fat_g: string | number | null;
  fiber_g: string | number | null;
}

interface CategoryOption {
  id: string;
  slug: string;
  name: string;
}

const PRESET_DISH_IMAGES = [
  { label: 'Fresh Mix Fruit Bowl', url: '/images/mix_fruit_bowl.png' },
  { label: 'Quinoa Paneer Bowl', url: '/images/quinoa_paneer_bowl.png' },
  { label: 'Grilled Chicken & Rice', url: '/images/grilled_chicken_brown_rice.png' },
  { label: 'Paneer Tikka Millet', url: '/images/paneer_tikka_millet.png' },
  { label: 'Green Detox Smoothie', url: '/images/green_detox_smoothie.png' },
  { label: 'Berry Protein Smoothie', url: '/images/berry_protein_smoothie.png' },
  { label: 'Peanut Butter Banana', url: '/images/peanut_butter_banana.png' },
  { label: 'Cold-Pressed ABC Juice', url: '/images/cold_pressed_abc_juice.png' },
  { label: 'Hummus & Veg Wrap', url: '/images/hummus_veg_wrap.png' },
  { label: 'Grilled Chicken Wrap', url: '/images/grilled_chicken_wrap.png' },
  { label: 'Egg White Avocado Wrap', url: '/images/egg_white_avocado_wrap.png' },
  { label: 'Paneer Tikka Wrap', url: '/images/paneer_tikka_wrap.png' },
  { label: 'Mediterranean Chicken', url: '/images/mediterranean_chicken.png' },
  { label: 'Chicken Caesar Salad', url: '/images/grilled_chicken_caesar.png' },
  { label: 'Sprouts & Peanut Bowl', url: '/images/sprouts_peanut_bowl.png' },
  { label: 'Protein Pancakes', url: '/images/protein_pancakes.png' },
];

const DEFAULT_IMAGE_MAP: Record<string, string> = {
  'quinoa-paneer-bowl': '/images/quinoa_paneer_bowl.png',
  'grilled-chicken-brown-rice': '/images/grilled_chicken_brown_rice.png',
  'paneer-tikka-millet-bowl': '/images/paneer_tikka_millet.png',
  'sprouts-peanut-bowl': '/images/sprouts_peanut_bowl.png',
  'mediterranean-chicken-hummus': '/images/hummus_bowl.png',
  'mediterranean-chicken-hummus-bowl': '/images/hummus_bowl.png',
  'protein-oats-honey-pancakes': '/images/protein_pancakes.png',
  'hummus-veg-wrap': '/images/hummus_veg_wrap.png',
  'grilled-chicken-wrap': '/images/grilled_chicken_wrap.png',
  'egg-white-avocado-wrap': '/images/egg_white_avocado_wrap.png',
  'paneer-tikka-wrap': '/images/paneer_tikka_wrap.png',
  'green-detox': '/images/green_detox_smoothie.png',
  'green-detox-smoothie': '/images/green_detox_smoothie.png',
  'berry-protein-smoothie': '/images/berry_protein_smoothie.png',
  'peanut-butter-banana-smoothie': '/images/peanut_butter_banana.png',
  'cold-pressed-abc-juice': '/images/cold_pressed_abc_juice.png',
  'mediterranean-chicken-salad': '/images/mediterranean_chicken.png',
  'grilled-chicken-caesar-lite': '/images/grilled_chicken_caesar.png',
  'sprout-feta-salad': '/images/sprouts_peanut_bowl.png',
  'fresh-mix-cut-fruit-bowl': '/images/mix_fruit_bowl.png',
  'berry-chia-oats': '/images/berry_chia_oats.png',
  'paneer-tikka-salad': '/images/paneer_tikka_salad.png',
  'chocolate-whey-shake': '/images/chocolate_whey_shake.png',
  'roasted-trail-mix': '/images/roasted_trail_mix.png',
};

function getImageUrl(row: Row): string {
  if (row.image_url && row.image_url.trim()) {
    return row.image_url.trim();
  }
  const slug = (row.slug || '').toLowerCase().trim();
  if (DEFAULT_IMAGE_MAP[slug]) {
    return DEFAULT_IMAGE_MAP[slug];
  }
  const name = (row.name || '').toLowerCase();
  if (name.includes('fruit') || name.includes('mix cut')) return '/images/mix_fruit_bowl.png';
  if (name.includes('detox') || name.includes('green')) return '/images/green_detox_smoothie.png';
  if (name.includes('berry') && name.includes('smoothie')) return '/images/berry_protein_smoothie.png';
  if (name.includes('peanut butter') || name.includes('banana')) return '/images/peanut_butter_banana.png';
  if (name.includes('abc') || name.includes('juice')) return '/images/cold_pressed_abc_juice.png';
  if (name.includes('pancake')) return '/images/protein_pancakes.png';
  if (name.includes('hummus') && name.includes('wrap')) return '/images/hummus_veg_wrap.png';
  if (name.includes('chicken') && name.includes('wrap')) return '/images/grilled_chicken_wrap.png';
  if (name.includes('egg') && name.includes('wrap')) return '/images/egg_white_avocado_wrap.png';
  if (name.includes('paneer') && name.includes('wrap')) return '/images/paneer_tikka_wrap.png';
  if (name.includes('caesar')) return '/images/grilled_chicken_caesar.png';
  if (name.includes('hummus') || name.includes('mediterranean')) return '/images/hummus_bowl.png';
  if (name.includes('paneer') && name.includes('salad')) return '/images/paneer_tikka_salad.png';
  if (name.includes('paneer') && name.includes('bowl')) return '/images/quinoa_paneer_bowl.png';
  if (name.includes('chicken') && name.includes('rice')) return '/images/grilled_chicken_brown_rice.png';
  if (name.includes('millet')) return '/images/paneer_tikka_millet.png';
  if (name.includes('sprout')) return '/images/sprouts_peanut_bowl.png';
  if (name.includes('shake') || name.includes('chocolate')) return '/images/chocolate_whey_shake.png';
  if (name.includes('oats')) return '/images/berry_chia_oats.png';

  return '/images/hero_bowl.png';
}

function DishThumbnail({ row }: { row: Row }) {
  const [failed, setFailed] = useState(false);
  const imgUrl = getImageUrl(row);
  const active = Boolean(Number(row.is_active));
  const available = row.is_available === undefined || row.is_available === null ? true : Boolean(Number(row.is_available));

  if (failed || !imgUrl) {
    return (
      <div className="relative size-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-xs">
        <Utensils className="size-5 text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="relative size-12 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0 shadow-xs group">
      <img
        src={imgUrl}
        alt={row.name}
        className={`w-full h-full object-cover ${!available && active ? 'opacity-60' : ''}`}
        onError={() => setFailed(true)}
      />
    </div>
  );
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

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export function MenuScreen({ session }: { session: AdminSession }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'out_of_stock' | 'off' | 'flagged'>('all');

  // Edit / Delete / Add Item Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Row | null>(null);
  const [deletingItem, setDeletingItem] = useState<Row | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url' | 'preset'>('upload');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category_id: '',
    price: '',
    description: '',
    image_url: '',
    prep_time: '15 mins',
    is_popular: false,
    is_active: true,
    is_available: true,
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    fiber_g: '',
  });

const FALLBACK_MENU_ROWS: Row[] = [
  {
    id: 'm1', name: 'Quinoa Paneer Bowl', slug: 'quinoa-paneer-bowl', price: 280,
    is_active: 1, is_available: 1, is_popular: 1, category_name: 'High Protein Bowls',
    calories: 520, protein_g: 38, carbs_g: 48, fat_g: 18, fiber_g: 8,
    image_url: '/images/quinoa_paneer_bowl.png', prep_time: '15 mins',
  },
  {
    id: 'm2', name: 'Grilled Chicken & Brown Rice', slug: 'grilled-chicken-brown-rice', price: 360,
    is_active: 1, is_available: 1, is_popular: 1, category_name: 'High Protein Bowls',
    calories: 580, protein_g: 48, carbs_g: 52, fat_g: 14, fiber_g: 6,
    image_url: '/images/grilled_chicken_brown_rice.png', prep_time: '20 mins',
  },
  {
    id: 'm3', name: 'Paneer Tikka Millet Bowl', slug: 'paneer-tikka-millet-bowl', price: 290,
    is_active: 1, is_available: 1, is_popular: 0, category_name: 'High Protein Bowls',
    calories: 490, protein_g: 32, carbs_g: 44, fat_g: 16, fiber_g: 7,
    image_url: '/images/paneer_tikka_millet.png', prep_time: '15 mins',
  },
  {
    id: 'm4', name: 'Mediterranean Chicken & Hummus', slug: 'mediterranean-chicken-hummus-bowl', price: 380,
    is_active: 1, is_available: 1, is_popular: 1, category_name: 'High Protein Bowls',
    calories: 540, protein_g: 44, carbs_g: 38, fat_g: 22, fiber_g: 9,
    image_url: '/images/hummus_bowl.png', prep_time: '15 mins',
  },
  {
    id: 'm5', name: 'Green Detox Smoothie', slug: 'green-detox-smoothie', price: 160,
    is_active: 1, is_available: 1, is_popular: 0, category_name: 'Smoothies & Juices',
    calories: 180, protein_g: 6, carbs_g: 34, fat_g: 2, fiber_g: 5,
    image_url: '/images/green_detox_smoothie.png', prep_time: '5 mins',
  },
  {
    id: 'm6', name: 'Berry Protein Smoothie', slug: 'berry-protein-smoothie', price: 190,
    is_active: 1, is_available: 1, is_popular: 1, category_name: 'Smoothies & Juices',
    calories: 280, protein_g: 26, carbs_g: 32, fat_g: 4, fiber_g: 4,
    image_url: '/images/berry_protein_smoothie.png', prep_time: '5 mins',
  },
  {
    id: 'm7', name: 'Grilled Chicken Wrap', slug: 'grilled-chicken-wrap', price: 260,
    is_active: 1, is_available: 1, is_popular: 0, category_name: 'Wraps & Salads',
    calories: 460, protein_g: 36, carbs_g: 40, fat_g: 14, fiber_g: 5,
    image_url: '/images/grilled_chicken_wrap.png', prep_time: '12 mins',
  },
];

  const fetchRows = useCallback(async () => {
    if (!isApiConfigured) {
      setRows(FALLBACK_MENU_ROWS);
      setLoading(false);
      return;
    }
    try {
      const { items } = await api.get<{ items: Row[] }>('/menu');
      setRows(items.length > 0 ? items : FALLBACK_MENU_ROWS);
    } catch {
      setRows(FALLBACK_MENU_ROWS);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    if (!isApiConfigured) {
      setCategories([
        { id: 'cat-1', slug: 'high-protein-bowls', name: 'High Protein Bowls' },
        { id: 'cat-2', slug: 'smoothies-juices', name: 'Smoothies & Juices' },
        { id: 'cat-3', slug: 'wraps-salads', name: 'Wraps & Salads' },
      ]);
      return;
    }
    try {
      const res = await api.get<{ categories: CategoryOption[] }>('/categories');
      setCategories(res.categories || []);
    } catch {
      setCategories([
        { id: 'cat-1', slug: 'high-protein-bowls', name: 'High Protein Bowls' },
        { id: 'cat-2', slug: 'smoothies-juices', name: 'Smoothies & Juices' },
        { id: 'cat-3', slug: 'wraps-salads', name: 'Wraps & Salads' },
      ]);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
    void fetchCategories();
  }, [fetchRows, fetchCategories]);

  // Handle Form Inputs
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-derive slug when typing name if slug hasn't been edited manually
      if (field === 'name' && (!prev.slug || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
        updated.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
      return updated;
    });
  };

  // Handle File Upload from device
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
      handleInputChange('image_url', processedDataUrl);
      toast.success(`Image "${file.name}" uploaded successfully!`);
    } catch (err) {
      toast.error('Failed to process image file');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Macro check preview for the form
  const formMacroPreview = useMemo(() => {
    const cal = num(formData.calories);
    const p = num(formData.protein_g);
    const c = num(formData.carbs_g);
    const f = num(formData.fat_g);
    const calculatedCals = Math.round(p * 4 + c * 4 + f * 9);

    if (cal <= 0) return null;
    const diff = Math.abs(cal - calculatedCals);
    const isValid = diff < (cal * 0.2); // Within 20% margin
    return {
      cal,
      calculatedCals,
      isValid,
    };
  }, [formData.calories, formData.protein_g, formData.carbs_g, formData.fat_g]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      slug: '',
      category_id: '',
      price: '',
      description: '',
      image_url: '',
      prep_time: '15 mins',
      is_popular: false,
      is_active: true,
      is_available: true,
      calories: '',
      protein_g: '',
      carbs_g: '',
      fat_g: '',
      fiber_g: '',
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (row: Row) => {
    setEditingItem(row);
    setFormData({
      name: row.name || '',
      slug: row.slug || '',
      category_id: row.category_id || '',
      price: row.price ? String(row.price) : '',
      description: row.description || '',
      image_url: row.image_url || '',
      prep_time: row.prep_time || '15 mins',
      is_popular: Boolean(Number(row.is_popular)),
      is_active: Boolean(Number(row.is_active)),
      is_available: row.is_available === undefined || row.is_available === null ? true : Boolean(Number(row.is_available)),
      calories: row.calories ? String(row.calories) : '',
      protein_g: row.protein_g ? String(row.protein_g) : '',
      carbs_g: row.carbs_g ? String(row.carbs_g) : '',
      fat_g: row.fat_g ? String(row.fat_g) : '',
      fiber_g: row.fiber_g ? String(row.fiber_g) : '',
    });
    setIsAddModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      if (isApiConfigured) {
        await api.delete(`/admin/menu/${deletingItem.id}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== deletingItem.id));
      toast.success(`Deleted "${deletingItem.name}" from menu`);
      setDeletingItem(null);
      void fetchRows();
    } catch (err) {
      toast.error('Failed to delete item', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit Menu Item (Create or Edit)
  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!formData.price || Number(formData.price) < 0) {
      toast.error('Valid price is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category_id: formData.category_id || undefined,
        price: Number(formData.price),
        description: formData.description.trim() || undefined,
        image_url: formData.image_url.trim() || undefined,
        prep_time: formData.prep_time.trim() || undefined,
        is_popular: formData.is_popular,
        is_active: formData.is_active,
        is_available: formData.is_available,
        calories: formData.calories ? Number(formData.calories) : 0,
        protein_g: formData.protein_g ? Number(formData.protein_g) : 0,
        carbs_g: formData.carbs_g ? Number(formData.carbs_g) : 0,
        fat_g: formData.fat_g ? Number(formData.fat_g) : 0,
        fiber_g: formData.fiber_g ? Number(formData.fiber_g) : 0,
      };

      if (editingItem) {
        let updatedItem: Row | null = null;
        if (isApiConfigured) {
          try {
            const res = await api.patch<{ item: Row }>(`/admin/menu/${editingItem.id}`, payload);
            updatedItem = res.item;
          } catch (apiErr) {
            console.warn('[MenuScreen] API update failed, using local fallback:', apiErr);
          }
        }
        if (updatedItem) {
          setRows((prev) => prev.map((r) => (r.id === updatedItem!.id ? { ...r, ...updatedItem! } : r)));
          toast.success(`Successfully updated "${updatedItem.name}"!`);
        } else {
          setRows((prev) =>
            prev.map((r) => (r.id === editingItem.id ? { ...r, ...payload, price: payload.price } : r))
          );
          toast.success(`Updated "${payload.name}"!`);
        }
      } else {
        let createdItem: Row | null = null;
        if (isApiConfigured) {
          try {
            const res = await api.post<{ item: Row }>('/admin/menu', payload);
            createdItem = res.item;
          } catch (apiErr) {
            console.warn('[MenuScreen] API create failed, using local fallback:', apiErr);
          }
        }
        if (createdItem) {
          setRows((prev) => [createdItem!, ...prev]);
          toast.success(`Successfully added "${createdItem.name}" to menu!`);
        } else {
          const selectedCat = categories.find((c) => c.id === formData.category_id);
          const newRow: Row = {
            id: `item-${Date.now()}`,
            name: payload.name,
            slug: payload.slug,
            price: payload.price,
            is_active: payload.is_active,
            is_available: payload.is_available,
            is_popular: payload.is_popular,
            category_name: selectedCat?.name || 'Main Course',
            calories: payload.calories,
            protein_g: payload.protein_g,
            carbs_g: payload.carbs_g,
            fat_g: payload.fat_g,
            fiber_g: payload.fiber_g,
            image_url: payload.image_url,
          };
          setRows((prev) => [newRow, ...prev]);
          toast.success(`Added "${payload.name}" to menu!`);
        }
      }

      setIsAddModalOpen(false);
      setEditingItem(null);
      // Reset Form
      setFormData({
        name: '',
        slug: '',
        category_id: '',
        price: '',
        description: '',
        image_url: '',
        prep_time: '15 mins',
        is_popular: false,
        is_active: true,
        is_available: true,
        calories: '',
        protein_g: '',
        carbs_g: '',
        fat_g: '',
        fiber_g: '',
      });
      void fetchRows();
    } catch (err) {
      toast.error(editingItem ? 'Failed to update menu item' : 'Failed to create menu item', {
        description: err instanceof Error ? err.message : 'Please check details and try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  async function updateStatus(row: Row, nextActive: boolean, nextAvailable: boolean) {
    setSaving(row.id);
    try {
      if (isApiConfigured) {
        await api.patch(`/admin/menu/${row.id}`, {
          is_active: nextActive,
          is_available: nextAvailable,
        });
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, is_active: nextActive, is_available: nextAvailable } : r
        )
      );

      const statusLabel = !nextActive
        ? 'Off (Hidden)'
        : !nextAvailable
        ? 'Out of Stock'
        : 'Live (In Stock)';

      toast.success(`Updated "${row.name}" status to ${statusLabel}`);
    } catch (e) {
      toast.error('Change rejected', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(null);
    }
  }

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Text search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        (row.category_name && row.category_name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Category Filter
      if (filterCategory !== 'all' && row.category_name !== filterCategory) {
        return false;
      }

      // Status Filter
      const active = Boolean(Number(row.is_active));
      const available = row.is_available === undefined || row.is_available === null ? true : Boolean(Number(row.is_available));

      if (filterStatus === 'live') return active && available;
      if (filterStatus === 'out_of_stock') return active && !available;
      if (filterStatus === 'off') return !active;

      if (filterStatus === 'flagged') {
        const n = {
          calories: num(row.calories),
          protein_g: num(row.protein_g),
          carbs_g: num(row.carbs_g),
          fat_g: num(row.fat_g),
          fiber_g: num(row.fiber_g),
        };
        return n.calories > 0 && !macrosLookPlausible(n);
      }

      return true;
    });
  }, [rows, searchQuery, filterCategory, filterStatus]);

  // Unique categories list from rows
  const rowCategories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.category_name) set.add(r.category_name);
    });
    return Array.from(set);
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500 py-12 justify-center">
        <Loader2 className="size-5 animate-spin text-emerald-600" /> Loading menu catalog…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-neutral-900 p-5 text-white shadow-lg border border-neutral-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Utensils className="size-5 text-emerald-400" />
            <h2 className="text-lg font-black tracking-tight">Menu & Recipe Catalog</h2>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              {rows.length} Items
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Manage live dishes, photos, out-of-stock toggles, pricing & macro profiles.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          disabled={!session.can('menu.write')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-neutral-950 hover:bg-emerald-400 active:scale-95 transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="size-4 stroke-[3]" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items by name, slug, or category..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Select */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-neutral-700 font-semibold cursor-pointer"
          >
            <option value="all">All Categories</option>
            {rowCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-neutral-700 font-semibold cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="live">Live (In Stock)</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="off">Off (Hidden)</option>
            <option value="flagged">Macro Flagged</option>
          </select>
        </div>
      </div>

      {/* Menu Table */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white shadow-xs">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="border-b border-neutral-200/70 bg-neutral-50/80 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Dish / Item Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">kcal</th>
              <th className="px-4 py-3 text-right">Protein / Carbs / Fat</th>
              <th className="px-4 py-3 text-center">Availability Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-medium">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-neutral-400 font-medium">
                  No menu items found matching your filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const n = {
                  calories: num(row.calories),
                  protein_g: num(row.protein_g),
                  carbs_g: num(row.carbs_g),
                  fat_g: num(row.fat_g),
                  fiber_g: num(row.fiber_g),
                };
                const active = Boolean(Number(row.is_active));
                const available = row.is_available === undefined || row.is_available === null ? true : Boolean(Number(row.is_available));
                const popular = Boolean(Number(row.is_popular));
                const suspicious = n.calories > 0 ? !macrosLookPlausible(n) : false;

                return (
                  <tr
                    key={row.id}
                    onClick={() => openEditModal(row)}
                    className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${active ? '' : 'bg-neutral-50/40 opacity-60'}`}
                  >
                    {/* Dish Name & Image Thumbnail */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <DishThumbnail row={row} />

                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-extrabold text-neutral-900 group-hover:text-emerald-700 transition-colors">
                              {row.name}
                            </div>
                            {popular && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black uppercase flex items-center gap-1 border border-amber-300">
                                <Sparkles className="size-3 text-amber-600" />
                                Popular
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-neutral-400 mt-0.5">{row.slug}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-neutral-600">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-neutral-100 px-2.5 py-0.5 rounded-lg text-neutral-700">
                        <Tag className="size-3 text-neutral-400" />
                        {row.category_name ?? 'Uncategorised'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums font-black text-neutral-900">
                      {formatINR(row.price)}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`inline-flex items-center gap-1 font-bold ${suspicious ? 'text-amber-600 font-extrabold' : 'text-neutral-900'}`}>
                        {suspicious && (
                          <span title="Macros don't match calorie count">
                            <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                        {n.calories > 0 ? Math.round(n.calories) : '-'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums text-neutral-600 text-xs">
                      {n.calories > 0 ? (
                        <span className="font-bold text-neutral-800">
                          <span className="text-emerald-700">{n.protein_g}g P</span> · {n.carbs_g}g C · {n.fat_g}g F
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* Interactive 3-State Status Pill Selector */}
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {saving === row.id ? (
                        <Loader2 className="size-4 animate-spin mx-auto text-emerald-600" />
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-neutral-100 p-1 rounded-full border border-neutral-200/80 text-[11px] font-extrabold select-none shadow-2xs">
                          <button
                            type="button"
                            onClick={() => void updateStatus(row, true, true)}
                            disabled={!session.can('menu.write')}
                            className={`px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                              active && available
                                ? 'bg-emerald-500 text-neutral-950 font-black shadow-xs'
                                : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                            title="Set Live & Available"
                          >
                            Live
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateStatus(row, true, false)}
                            disabled={!session.can('menu.write')}
                            className={`px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                              active && !available
                                ? 'bg-amber-500 text-neutral-950 font-black shadow-xs'
                                : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                            title="Mark as Out of Stock (Sold Out)"
                          >
                            Out of Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateStatus(row, false, false)}
                            disabled={!session.can('menu.write')}
                            className={`px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                              !active
                                ? 'bg-neutral-600 text-white font-black shadow-xs'
                                : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                            title="Hide dish completely"
                          >
                            Off
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          disabled={!session.can('menu.write')}
                          title="Edit Dish Details"
                          className="p-2 rounded-xl text-neutral-500 hover:text-emerald-700 hover:bg-emerald-100/70 border border-transparent hover:border-emerald-200 transition cursor-pointer disabled:opacity-40"
                        >
                          <Pencil className="size-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingItem(row)}
                          disabled={!session.can('menu.write')}
                          title="Delete Menu Dish"
                          className="p-2 rounded-xl text-neutral-500 hover:text-red-700 hover:bg-red-100/70 border border-transparent hover:border-red-200 transition cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500 flex items-center gap-1">
        <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
        <span>
          Dietitian macro counts are verified dynamically. Items marked as <strong>Out of Stock</strong> will display a &quot;Sold Out&quot; badge on storefront product cards.
        </span>
      </p>

      {/* ========================================================================= */}
      {/* ADD MENU ITEM MODAL DIALOG */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden animate-scale-in my-8">
            {/* Modal Header */}
            <div className="bg-neutral-900 text-white p-5 flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Utensils className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">
                    {editingItem ? `Edit "${editingItem.name}"` : 'Add New Menu Dish'}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {editingItem ? 'Update pricing, portion macros, photo & category' : 'Create a dish with prices, categories & nutritional macros'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItem(null);
                }}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleAddItemSubmit} className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Basic Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 border-b border-neutral-100 pb-1">
                  <Tag className="size-3.5 text-emerald-600" />
                  Basic Item Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">Dish Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Teriyaki Salmon Bowl"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold"
                    />
                  </div>

                  {/* Price */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      placeholder="399"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-black text-neutral-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Category Select */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">Category</label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => handleInputChange('category_id', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold bg-white cursor-pointer"
                    >
                      <option value="">Select Category (Optional)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Slug */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">URL Slug</label>
                    <input
                      type="text"
                      placeholder="teriyaki-salmon-bowl"
                      value={formData.slug}
                      onChange={(e) => handleInputChange('slug', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-mono text-neutral-600"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-extrabold text-neutral-700">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Short description of ingredients, flavors & macro profile..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
                  />
                </div>

                {/* Dish Image Upload & Selection Section */}
                <div className="space-y-2 pt-1 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-neutral-800 flex items-center gap-1.5">
                      <Camera className="size-4 text-emerald-600" />
                      <span>Dish Cover Photo</span>
                    </label>

                    {/* Image Mode Switcher Tabs */}
                    <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setImageMode('upload')}
                        className={`px-2.5 py-1 rounded-md transition ${imageMode === 'upload' ? 'bg-white text-emerald-900 shadow-xs font-extrabold' : 'text-neutral-500 hover:text-neutral-900'}`}
                      >
                        <Upload className="inline size-3 mr-1" />
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode('preset')}
                        className={`px-2.5 py-1 rounded-md transition ${imageMode === 'preset' ? 'bg-white text-emerald-900 shadow-xs font-extrabold' : 'text-neutral-500 hover:text-neutral-900'}`}
                      >
                        <FileImage className="inline size-3 mr-1" />
                        Presets
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode('url')}
                        className={`px-2.5 py-1 rounded-md transition ${imageMode === 'url' ? 'bg-white text-emerald-900 shadow-xs font-extrabold' : 'text-neutral-500 hover:text-neutral-900'}`}
                      >
                        <Link className="inline size-3 mr-1" />
                        URL
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: Local Device Upload Zone */}
                  {imageMode === 'upload' && (
                    <div className="space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />

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
                                  handleInputChange('image_url', url);
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
                            <Loader2 className="size-6 animate-spin text-emerald-600" />
                            <span>Processing & optimizing image...</span>
                          </div>
                        ) : formData.image_url ? (
                          <div className="flex items-center gap-4 text-left">
                            <img
                              src={formData.image_url}
                              alt="Dish preview"
                              className="size-16 object-cover rounded-xl border border-neutral-200 shadow-xs shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-extrabold text-emerald-900 block truncate">
                                Image attached successfully!
                              </span>
                              <span className="text-[11px] text-neutral-500 font-medium block truncate">
                                Click to replace with another photo
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInputChange('image_url', '');
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition shrink-0"
                              title="Remove Image"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 py-1">
                            <div className="p-3 rounded-full bg-emerald-100/80 text-emerald-700 group-hover:scale-110 transition">
                              <Upload className="size-5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-emerald-950 block text-xs">
                                Click to upload dish photo from computer
                              </span>
                              <span className="text-[11px] text-neutral-500 font-medium">
                                Supports PNG, JPG, WebP (Auto-optimized & compressed)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Preset Library Dropdown */}
                  {imageMode === 'preset' && (
                    <div className="space-y-2">
                      <select
                        value={formData.image_url}
                        onChange={(e) => handleInputChange('image_url', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold bg-white cursor-pointer"
                      >
                        <option value="">Select a built-in dish photo...</option>
                        {PRESET_DISH_IMAGES.map((preset) => (
                          <option key={preset.url} value={preset.url}>
                            {preset.label}
                          </option>
                        ))}
                      </select>

                      {formData.image_url && (
                        <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-xl border border-neutral-200">
                          <img
                            src={formData.image_url}
                            alt="Preset preview"
                            className="size-12 object-cover rounded-lg border border-neutral-200 shrink-0"
                          />
                          <div className="text-xs">
                            <span className="font-extrabold text-neutral-800 block">Selected Preset:</span>
                            <span className="font-mono text-[11px] text-neutral-500">{formData.image_url}</span>
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
                        value={formData.image_url}
                        onChange={(e) => handleInputChange('image_url', e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
                      />
                      {formData.image_url && (
                        <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-xl border border-neutral-200">
                          <img
                            src={formData.image_url}
                            alt="URL preview"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/hero_bowl.png';
                            }}
                            className="size-12 object-cover rounded-lg border border-neutral-200 shrink-0"
                          />
                          <span className="text-[11px] font-medium text-neutral-600 truncate">
                            {formData.image_url}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kitchen Prep Time */}
                  <div className="space-y-1 pt-1">
                    <label className="font-extrabold text-neutral-700">Kitchen Prep Time</label>
                    <input
                      type="text"
                      placeholder="15 mins"
                      value={formData.prep_time}
                      onChange={(e) => handleInputChange('prep_time', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Nutritional Macro Profile */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Flame className="size-3.5 text-orange-500" />
                    Macro & Calorie Profile
                  </h4>
                  {formMacroPreview && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      formMacroPreview.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}>
                      Macro ~{formMacroPreview.calculatedCals} kcal ({formMacroPreview.isValid ? 'Match' : 'Check values'})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {/* Calories */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">Calories (kcal)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="520"
                      value={formData.calories}
                      onChange={(e) => handleInputChange('calories', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-bold"
                    />
                  </div>

                  {/* Protein */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-emerald-800">Protein (g)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="45"
                      value={formData.protein_g}
                      onChange={(e) => handleInputChange('protein_g', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-bold bg-emerald-50/30"
                    />
                  </div>

                  {/* Carbs */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">Carbs (g)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="40"
                      value={formData.carbs_g}
                      onChange={(e) => handleInputChange('carbs_g', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-bold"
                    />
                  </div>

                  {/* Fat */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">Fat (g)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="18"
                      value={formData.fat_g}
                      onChange={(e) => handleInputChange('fat_g', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-bold"
                    />
                  </div>

                  {/* Fiber */}
                  <div className="space-y-1">
                    <label className="font-extrabold text-neutral-700">Fiber (g)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="8"
                      value={formData.fiber_g}
                      onChange={(e) => handleInputChange('fiber_g', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-neutral-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    className="size-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-neutral-800">Publish Dish Live</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_available}
                    onChange={(e) => handleInputChange('is_available', e.target.checked)}
                    className="size-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-neutral-800">In Stock / Available</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_popular}
                    onChange={(e) => handleInputChange('is_popular', e.target.checked)}
                    className="size-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-bold text-neutral-800 flex items-center gap-1">
                    <Sparkles className="size-3.5 text-amber-500" />
                    Mark as Popular
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = editingItem;
                      setIsAddModalOpen(false);
                      setEditingItem(null);
                      setDeletingItem(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold text-red-600 hover:bg-red-50 transition cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                    <span>Delete Dish</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingItem(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 font-bold text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 font-black text-neutral-950 hover:bg-emerald-400 active:scale-95 transition cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>{editingItem ? 'Saving Changes...' : 'Creating Dish...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4 stroke-[2.5]" />
                        <span>{editingItem ? 'Save Changes' : 'Create Menu Item'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL DIALOG */}
      {/* ========================================================================= */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 rounded-2xl bg-red-100 border border-red-200 shrink-0">
                <Trash2 className="size-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">Delete Menu Dish?</h3>
                <p className="text-xs text-neutral-500 font-medium">This will remove the item from catalog</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200 font-medium">
              Are you sure you want to delete <strong className="text-neutral-900">&quot;{deletingItem.name}&quot;</strong> from the menu?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 font-extrabold text-xs text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-red-600 font-extrabold text-xs text-white hover:bg-red-700 active:scale-95 transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="size-4 animate-spin" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Dish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
