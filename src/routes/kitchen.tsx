import React, { useState, useEffect } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useProductStore } from '../store/useProductStore';
import { useOrderStore, OrderStatus } from '../store/useOrderStore';
import { useInventoryStore, InventoryItem } from '../store/useInventoryStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { Product } from '../lib/shopify';
import { formatCurrency } from '../lib/nutritionParser';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Users,
  Package,
  TrendingUp,
  Flame,
  Search,
  Lock,
  ArrowRight,
  Utensils,
  ShoppingBag,
  Clock,
  RefreshCw,
  LogOut,
  KeyRound,
  Mail,
  Zap,
  MapPin,
  Phone,
  Home,
  ShieldAlert,
  Boxes,
  AlertTriangle,
  Layers,
  PlusCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/kitchen')({
  head: () => ({
    meta: [
      { title: 'Private Executive Portal — Bro-Ko-Le' },
      { name: 'description', content: 'Restricted Executive Kitchen Operations, Inventory & Live Orders Portal.' },
    ],
  }),
  component: KitchenPage,
});

// Mock Customer Data for Monitoring
const INITIAL_CUSTOMERS = [
  {
    id: 'CUST-101',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    phone: '+91 98765 43210',
    address: '42 Park Avenue, Koramangala 5th Block, Bengaluru, 560095',
    dietary: ['High Protein', 'Gluten Free'],
    ordersCount: 14,
    totalSpent: 4186,
    lastOrderDate: 'Today, 2:15 PM',
    status: 'ACTIVE',
  },
  {
    id: 'CUST-102',
    name: 'Priya Sharma',
    email: 'priya.s@healthlife.org',
    phone: '+91 98123 76543',
    address: '88 Indiranagar 100ft Road, Bengaluru, 560038',
    dietary: ['Low Carb', 'Vegan'],
    ordersCount: 8,
    totalSpent: 2192,
    lastOrderDate: 'Yesterday, 8:30 PM',
    status: 'ACTIVE',
  },
  {
    id: 'CUST-103',
    name: 'Rohan Verma',
    email: 'rohan.v@techstudio.io',
    phone: '+91 97654 32109',
    address: '15 HSR Layout Sector 1, Bengaluru, 560102',
    dietary: ['High Protein', 'Keto Friendly'],
    ordersCount: 22,
    totalSpent: 7458,
    lastOrderDate: 'Today, 11:45 AM',
    status: 'VIP',
  },
  {
    id: 'CUST-104',
    name: 'Ananya Patel',
    email: 'ananya.p@gmail.com',
    phone: '+91 99887 66554',
    address: '102 Whitefield Main Rd, Bengaluru, 560066',
    dietary: ['Gluten Free'],
    ordersCount: 5,
    totalSpent: 1395,
    lastOrderDate: '16 Aug 2026',
    status: 'ACTIVE',
  },
];

const PRESET_IMAGES = [
  { label: 'Mediterranean Hummus Bowl', url: '/images/hummus_bowl.png' },
  { label: 'Protein Oats & Honey Pancakes', url: '/images/protein_pancakes.png' },
  { label: 'Grilled Chicken Bowl', url: '/images/grilled_chicken_bowl.png' },
  { label: 'Paneer Tikka Salad', url: '/images/paneer_tikka_salad.png' },
  { label: 'Berry Chia Oats', url: '/images/berry_chia_oats.png' },
  { label: 'Green Detox Smoothie', url: '/images/green_detox_smoothie.png' },
  { label: 'Chocolate Whey Shake', url: '/images/chocolate_whey_shake.png' },
  { label: 'Roasted Trail Mix', url: '/images/roasted_trail_mix.png' },
];

function KitchenPage() {
  const navigate = useNavigate();

  // Persistent Private Admin Session (Strict Gatekeeper)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('brokole_admin_auth') === 'true';
    }
    return false;
  });

  const [adminEmail, setAdminEmail] = useState('admin@brokole.com');
  const [adminPassword, setAdminPassword] = useState('');

  // Active tab state: orders | products | inventory | customers
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'inventory' | 'customers'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'products' || tabParam === 'customers' || tabParam === 'orders' || tabParam === 'inventory') {
        return tabParam as any;
      }
    }
    return 'orders';
  });

  const { products, addProduct, deleteProduct, resetProducts } = useProductStore();
  const { orders, updateOrderStatus, deleteOrder, simulateNewOrder, resetOrders } = useOrderStore();
  const { items: inventoryItems, restockItem, updateStock, addItem: addInventoryItem, deleteItem: deleteInventoryItem, restockAllLowItems, resetInventory } = useInventoryStore();
  const { customers, deleteCustomer: deleteCustomerRecord, resetCustomers } = useCustomerStore();

  // Add Product Form State
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('199');
  const [productType, setProductType] = useState('High Protein');
  const [prepTime, setPrepTime] = useState('20-25 mins');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('/images/grilled_chicken_bowl.png');
  const [tagsInput, setTagsInput] = useState('High Protein, Healthy');
  const [isPopular, setIsPopular] = useState(false);

  const [calories, setCalories] = useState('450');
  const [protein, setProtein] = useState('35');
  const [carbs, setCarbs] = useState('30');
  const [fat, setFat] = useState('12');
  const [fiber, setFiber] = useState('6');

  // Inventory Form & Filter State
  const [ingName, setIngName] = useState('');
  const [ingCategory, setIngCategory] = useState<InventoryItem['category']>('Protein');
  const [ingQty, setIngQty] = useState('20');
  const [ingUnit, setIngUnit] = useState<InventoryItem['unit']>('kg');
  const [ingMinThreshold, setIngMinThreshold] = useState('10');
  const [ingCost, setIngCost] = useState('250');
  const [ingSupplier, setIngSupplier] = useState('FarmFresh Supplies');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>('all');

  const [customerSearch, setCustomerSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [autoSimulate, setAutoSimulate] = useState(false);

  // Auto order simulation timer
  useEffect(() => {
    if (!autoSimulate || !isAdminAuthenticated) return;
    const interval = setInterval(() => {
      const generated = simulateNewOrder();
      toast.info(`🔔 Auto-simulated new live order #${generated.id}!`);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoSimulate, isAdminAuthenticated, simulateNewOrder]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) {
      toast.error('Please enter Executive Email or PIN');
      return;
    }

    if (adminPassword === '1234' || adminPassword === 'admin123' || adminPassword === 'admin' || adminPassword === '') {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('brokole_admin_auth', 'true');
      }
      setIsAdminAuthenticated(true);
      toast.success(`Executive Portal Unlocked!`, {
        description: `Authenticated as Head Operations (${adminEmail})`,
      });
    } else {
      toast.error('Access Denied: Invalid Security Key / PIN (Default PIN: 1234)');
    }
  };

  const handleQuickDemoLogin = () => {
    setAdminEmail('admin@brokole.com');
    setAdminPassword('1234');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('brokole_admin_auth', 'true');
    }
    setIsAdminAuthenticated(true);
    toast.success('Private Executive Portal Unlocked (Demo PIN)');
  };

  const handleAdminLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('brokole_admin_auth');
    }
    setIsAdminAuthenticated(false);
    toast.info('Locked Executive Portal & revoked admin session');
    navigate({ to: '/' });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a product title');
      return;
    }

    const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

    const newMeal: Omit<Product, 'id'> = {
      handle,
      title,
      productType,
      tags,
      description: `${description}\n\nCalories: ${calories} kcal | Protein: ${protein}g | Carbs: ${carbs}g | Fat: ${fat}g | Fiber: ${fiber}g`,
      featuredImage: {
        url: imageUrl,
        altText: title,
      },
      images: [{ url: imageUrl, altText: title }],
      priceRange: {
        minVariantPrice: {
          amount: price,
          currencyCode: 'INR',
        },
      },
      variants: [
        {
          id: `variant-${Date.now()}`,
          title: `Standard Portion (${protein}g Protein)`,
          price: { amount: price, currencyCode: 'INR' },
          availableForSale: true,
        },
      ],
      nutrition: {
        calories: parseInt(calories) || 400,
        protein: parseInt(protein) || 30,
        carbs: parseInt(carbs) || 30,
        fat: parseInt(fat) || 10,
        fiber: parseInt(fiber) || 5,
      },
      prepTime,
      isPopular,
    };

    addProduct(newMeal);
    toast.success(`Added "${title}" to Bro-Ko-Le menu!`, {
      description: `₹${price} • ${protein}g Protein`,
    });

    setTitle('');
    setDescription('');
  };

  const handleAddInventory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName.trim()) {
      toast.error('Please enter ingredient name');
      return;
    }

    addInventoryItem({
      name: ingName,
      category: ingCategory,
      stockQuantity: parseFloat(ingQty) || 10,
      unit: ingUnit,
      minThreshold: parseFloat(ingMinThreshold) || 5,
      costPerUnit: parseFloat(ingCost) || 100,
      supplier: ingSupplier || 'Local Farm Direct',
    });

    toast.success(`Added "${ingName}" to raw ingredient inventory!`);
    setIngName('');
  };

  const handleDeleteProduct = (id: string, prodTitle: string) => {
    deleteProduct(id);
    toast.info(`Deleted "${prodTitle}" from catalog`);
  };

  const handleSimulateOrderClick = () => {
    const newOrd = simulateNewOrder();
    toast.success(`Simulated new incoming order #${newOrd.id}!`, {
      description: `${newOrd.customerName} • ₹${newOrd.totalAmount} • ${newOrd.proteinGrams}g Protein`,
    });
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      c.address.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerPhone.includes(orderSearch) ||
      o.itemsSummary.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerAddress.toLowerCase().includes(orderSearch.toLowerCase());

    const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredInventory = inventoryItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.supplier.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.category.toLowerCase().includes(inventorySearch.toLowerCase());

    const matchesCat = inventoryCategoryFilter === 'all' || item.category === inventoryCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const newOrdersCount = orders.filter((o) => o.status === 'New Order').length;
  const preparingCount = orders.filter((o) => o.status === 'Preparing').length;
  const deliveryCount = orders.filter((o) => o.status === 'Out for Delivery').length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  const lowStockCount = inventoryItems.filter((i) => i.status === 'Low Stock' || i.status === 'Critical').length;
  const totalInventoryValue = inventoryItems.reduce((sum, i) => sum + i.stockQuantity * i.costPerUnit, 0);

  // STRICT PRIVATE PORTAL GATEKEEPER SCREEN (For Unauthorized Visitors)
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-8 shadow-2xl carved-box space-y-6">
          
          {/* Private Gatekeeper Lock Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mx-auto shadow-md">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight flex items-center justify-center gap-2">
                <span>Private Executive Portal</span>
                <Lock className="w-5 h-5 text-amber-500" />
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] font-semibold mt-1">
                Restricted Operations Area • Authorized Kitchen Staff Only
              </p>
            </div>
          </div>

          {/* Admin Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                Executive Staff Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                <input
                  type="text"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@brokole.com"
                  className="w-full pl-10 pr-4 py-3.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-primary)] shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                Executive Security Key / PIN
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter Security PIN (Default: 1234)"
                  className="w-full pl-10 pr-4 py-3.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-sm font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-primary)] shadow-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 px-4 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black text-sm hover:bg-[var(--color-primary-hover)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
            >
              <ShieldCheck className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Authenticate & Unlock Private Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Lock Passcode & Exit Button */}
          <div className="pt-3 text-center border-t border-[var(--color-border-subtle)] space-y-3">
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              className="w-full py-3 rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-text-on-accent)] font-extrabold text-xs hover:bg-[var(--color-accent)] transition-all cursor-pointer carved-btn border border-[var(--color-accent-glow)]"
            >
              ⚡ Unlock with Demo Keycode (1234)
            </button>

            <Link
              to="/"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Return to Public Bro-Ko-Le Storefront</span>
            </Link>
          </div>

        </div>
      </div>
    );
  }

  // UNLOCKED PRIVATE EXECUTIVE DASHBOARD
  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[var(--color-primary)] text-[var(--color-accent)] shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
              Bro-Ko-Le Control Center
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] font-semibold">
              Authenticated Session: <strong className="text-[var(--color-primary)]">{adminEmail}</strong>
            </p>
          </div>
        </div>

        {/* Tab & Logout Header Controls */}
        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap sm:flex-nowrap">
          <div className="flex bg-[var(--color-surface-hover)] p-1 rounded-2xl border border-[var(--color-border)]">
            
            {/* NEW ORDERS TAB */}
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
                activeTab === 'orders'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Live Orders ({orders.length})</span>
              {newOrdersCount > 0 && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )}
            </button>

            {/* CATALOG MANAGEMENT TAB */}
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Catalog ({products.length})</span>
            </button>

            {/* INVENTORY STOCK TAB */}
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
                activeTab === 'inventory'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Inventory Stock ({inventoryItems.length})</span>
              {lowStockCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black animate-pulse">
                  {lowStockCount} LOW
                </span>
              )}
            </button>

            {/* CUSTOMERS TAB */}
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customer Telemetry</span>
            </button>
          </div>

          <button
            onClick={handleAdminLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-red-50 text-[var(--color-error)] text-xs font-extrabold hover:bg-red-100 border border-red-200 transition-all cursor-pointer carved-btn"
            title="Lock Executive Portal"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Lock Portal</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs carved-box">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-2">
            <span className="text-xs font-bold uppercase">Live Orders Feed</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--color-text-main)]">{orders.length}</span>
            {newOrdersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">
                {newOrdersCount} New
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-primary)] font-semibold mt-1">Real-time dispatch active</p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs carved-box">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-2">
            <span className="text-xs font-bold uppercase">Preparing / Kitchen</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-black text-[var(--color-text-main)]">{preparingCount}</span>
          <p className="text-[10px] text-amber-600 font-semibold mt-1">In kitchen queue</p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs carved-box">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-2">
            <span className="text-xs font-bold uppercase">Raw Ingredient Stock</span>
            <Boxes className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--color-text-main)]">{inventoryItems.length} items</span>
            {lowStockCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-black uppercase">
                {lowStockCount} Low
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-primary)] font-semibold mt-1">Valuation: {formatCurrency(totalInventoryValue)}</p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs carved-box">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-2">
            <span className="text-xs font-bold uppercase">Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-[var(--color-deal)]" />
          </div>
          <span className="text-2xl font-black text-[var(--color-text-main)]">
            {formatCurrency(482900 + totalRevenue)}
          </span>
          <p className="text-[10px] text-[var(--color-primary)] font-semibold mt-1">₹338 Avg Order Value</p>
        </div>
      </div>

      {/* TAB 1: NEW & LIVE ORDERS FEED */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box space-y-5">
            
            {/* Live Orders Header & Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-lg font-black text-[var(--color-text-main)] flex items-center gap-2">
                    <span>New Orders & Kitchen Dispatch Queue</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-black">
                      {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-semibold">
                  Incoming pre-orders, delivery updates, and popup alert notification trigger
                </p>
              </div>

              {/* Action Buttons: Simulate Order, Auto-Simulate Toggle, Reset */}
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <button
                  onClick={handleSimulateOrderClick}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md carved-btn active:scale-[0.98]"
                >
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                  <span>⚡ Simulate New Order</span>
                </button>

                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)]">
                  <input
                    type="checkbox"
                    id="auto-simulate"
                    checked={autoSimulate}
                    onChange={(e) => setAutoSimulate(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="auto-simulate" className="cursor-pointer select-none">
                    Auto-Simulate (20s)
                  </label>
                </div>

                <button
                  onClick={() => {
                    resetOrders();
                    toast.info('Reset live orders feed to initial state');
                  }}
                  className="p-2.5 rounded-2xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
                  title="Reset Orders"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Chips & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              
              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 'all', label: 'All Orders', count: orders.length },
                  { id: 'New Order', label: 'New', count: newOrdersCount },
                  { id: 'Preparing', label: 'Preparing', count: preparingCount },
                  { id: 'Out for Delivery', label: 'Out for Delivery', count: deliveryCount },
                  { id: 'Delivered', label: 'Delivered', count: orders.filter((o) => o.status === 'Delivered').length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setOrderStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                      orderStatusFilter === tab.id
                        ? 'bg-[var(--color-primary)] text-white shadow-xs'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border border-[var(--color-border)]'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by ID, customer, address..."
                  className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                />
              </div>

            </div>

            {/* Orders Feed Cards */}
            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-[var(--color-text-muted)] space-y-3">
                <ShoppingBag className="w-10 h-10 mx-auto opacity-40 text-[var(--color-primary)]" />
                <p className="text-sm font-bold text-[var(--color-text-main)]">No orders found matching filter</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Click "⚡ Simulate New Order" above to generate a new live order!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOrders.map((ord) => {
                  const isNew = ord.status === 'New Order';

                  return (
                    <div
                      key={ord.id}
                      className={`p-5 rounded-3xl border transition-all carved-box space-y-4 relative ${
                        isNew
                          ? 'bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20'
                          : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]'
                      }`}
                    >
                      {/* Top Row: Order ID, Time, Status Pill & Actions */}
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-[var(--color-text-main)] tracking-tight">
                            {ord.id}
                          </span>
                          {ord.isNew && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider animate-pulse">
                              NEW ORDER
                            </span>
                          )}
                          <span className="text-[11px] text-[var(--color-text-muted)] font-semibold">
                            • {ord.timeFormatted}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              deleteOrder(ord.id);
                              toast.info(`Deleted order ${ord.id}`);
                            }}
                            className="p-1.5 rounded-xl hover:bg-red-50 text-[var(--color-text-light)] hover:text-red-600 transition-colors cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Customer Details */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-[var(--color-text-main)]">
                            {ord.customerName}
                          </span>
                          <a
                            href={`tel:${ord.customerPhone}`}
                            className="flex items-center gap-1 text-[11px] font-extrabold text-[var(--color-primary)] hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{ord.customerPhone}</span>
                          </a>
                        </div>

                        <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-text-muted)] font-medium">
                          <MapPin className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{ord.customerAddress}</span>
                        </div>
                      </div>

                      {/* Ordered Items Summary */}
                      <div className="p-3.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2">
                        <span className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">
                          Ordered Items
                        </span>
                        <p className="text-xs font-extrabold text-[var(--color-text-main)] leading-relaxed">
                          {ord.itemsSummary}
                        </p>
                        
                        <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)] text-xs">
                          <span className="flex items-center gap-1 font-extrabold text-amber-600">
                            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{ord.proteinGrams}g Protein Delivered</span>
                          </span>
                          <span className="font-black text-sm text-[var(--color-primary)]">
                            {formatCurrency(ord.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Status Action Buttons Bar */}
                      <div className="pt-1 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                          Status:
                        </span>

                        <div className="flex items-center gap-1.5 overflow-x-auto">
                          {(['New Order', 'Preparing', 'Out for Delivery', 'Delivered'] as OrderStatus[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => {
                                updateOrderStatus(ord.id, st);
                                toast.success(`Order ${ord.id} status updated to "${st}"`);
                              }}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                                ord.status === st
                                  ? st === 'New Order'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : st === 'Preparing'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : st === 'Out for Delivery'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-emerald-700 text-white shadow-xs'
                                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border border-[var(--color-border)]'
                              }`}
                            >
                              {st === 'New Order' && '🟢 New'}
                              {st === 'Preparing' && '🍳 Prep'}
                              {st === 'Out for Delivery' && '🛵 Delivery'}
                              {st === 'Delivered' && '✅ Done'}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY & INGREDIENT STOCK MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: Add Ingredient Form */}
          <div className="lg:col-span-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <h2 className="text-base font-black text-[var(--color-text-main)] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[var(--color-primary)]" />
                <span>Add Ingredient Stock</span>
              </h2>
            </div>

            <form onSubmit={handleAddInventory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                  Ingredient Name
                </label>
                <input
                  type="text"
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                  placeholder="e.g. Organic Tofu / Wild Atlantic Salmon"
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Category
                  </label>
                  <select
                    value={ingCategory}
                    onChange={(e) => setIngCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  >
                    <option value="Protein">Protein</option>
                    <option value="Grains & Carbs">Grains & Carbs</option>
                    <option value="Produce">Produce</option>
                    <option value="Healthy Fats">Healthy Fats</option>
                    <option value="Dairy & Whey">Dairy & Whey</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Stock Unit
                  </label>
                  <select
                    value={ingUnit}
                    onChange={(e) => setIngUnit(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="grams">Grams (g)</option>
                    <option value="liters">Liters (L)</option>
                    <option value="units">Units / Pieces</option>
                    <option value="packs">Packs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Initial Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={ingQty}
                    onChange={(e) => setIngQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Min Alert Level
                  </label>
                  <input
                    type="number"
                    value={ingMinThreshold}
                    onChange={(e) => setIngMinThreshold(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Cost per Unit (₹)
                  </label>
                  <input
                    type="number"
                    value={ingCost}
                    onChange={(e) => setIngCost(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    value={ingSupplier}
                    onChange={(e) => setIngSupplier(e.target.value)}
                    placeholder="e.g. GreenHarvest Agros"
                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black text-sm hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>Add Ingredient Stock Item</span>
              </button>
            </form>
          </div>

          {/* Right Column: Inventory List & Actions */}
          <div className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box space-y-5">
            
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <h2 className="text-base font-black text-[var(--color-text-main)] flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-[var(--color-primary)]" />
                  <span>Raw Ingredients & Stock Inventory ({filteredInventory.length})</span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] font-medium">
                  Track ingredient levels, low-stock thresholds & instant batch restock
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    restockAllLowItems();
                    toast.success('Batch restocked all low-stock & critical items!');
                  }}
                  className="px-3.5 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs carved-btn"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>⚡ Batch Restock Low Items</span>
                </button>

                <button
                  onClick={() => {
                    resetInventory();
                    toast.info('Reset inventory stock data');
                  }}
                  className="p-2 rounded-2xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
                  title="Reset Inventory"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Chips & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['all', 'Protein', 'Grains & Carbs', 'Produce', 'Healthy Fats', 'Dairy & Whey', 'Packaging'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setInventoryCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                      inventoryCategoryFilter === cat
                        ? 'bg-[var(--color-primary)] text-white shadow-xs'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border border-[var(--color-border)]'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search ingredient or supplier..."
                  className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                />
              </div>
            </div>

            {/* Stock Items Cards List */}
            <div className="space-y-3">
              {filteredInventory.map((item) => {
                const isCritical = item.status === 'Critical';
                const isLow = item.status === 'Low Stock';
                const pct = Math.min(100, Math.round((item.stockQuantity / (item.minThreshold * 3)) * 100));

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all carved-box space-y-3 ${
                      isCritical
                        ? 'bg-red-500/5 border-red-500/40'
                        : isLow
                        ? 'bg-amber-500/5 border-amber-500/40'
                        : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]'
                    }`}
                  >
                    {/* Header Line */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-[var(--color-text-main)] truncate">
                          {item.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-extrabold shrink-0">
                          {item.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCritical ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black uppercase animate-pulse flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>CRITICAL</span>
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>LOW STOCK</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase">
                            IN STOCK
                          </span>
                        )}

                        <button
                          onClick={() => {
                            deleteInventoryItem(item.id);
                            toast.info(`Removed ${item.name} from inventory`);
                          }}
                          className="p-1 rounded-lg text-[var(--color-text-light)] hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stock Bar & Quantities */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-[var(--color-text-main)]">
                          Current Stock: <strong className="text-sm text-[var(--color-primary)]">{item.stockQuantity} {item.unit}</strong>
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-semibold">
                          Min Alert: {item.minThreshold} {item.unit} • ₹{item.costPerUnit}/{item.unit}
                        </span>
                      </div>

                      {/* Stock Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Actions & Supplier Info */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--color-border-subtle)]">
                      <span className="text-[var(--color-text-muted)] font-semibold">
                        Vendor: <strong className="text-[var(--color-text-main)]">{item.supplier}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            updateStock(item.id, item.stockQuantity - 1);
                            toast.info(`Consumed 1 ${item.unit} of ${item.name}`);
                          }}
                          className="px-2 py-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          - 1
                        </button>

                        <button
                          onClick={() => {
                            restockItem(item.id, 5);
                            toast.success(`Restocked +5 ${item.unit} of ${item.name}!`);
                          }}
                          className="px-2.5 py-0.5 rounded-lg bg-[var(--color-primary)] text-white font-extrabold hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                        >
                          +5 Restock
                        </button>

                        <button
                          onClick={() => {
                            restockItem(item.id, 10);
                            toast.success(`Restocked +10 ${item.unit} of ${item.name}!`);
                          }}
                          className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          +10 Restock
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>
      )}

      {/* TAB 3: CATALOG MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Add Product Form Column */}
          <div className="lg:col-span-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <h2 className="text-base font-black text-[var(--color-text-main)] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[var(--color-primary)]" />
                <span>Add New Meal to Menu</span>
              </h2>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                  Meal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Teriyaki Salmon Macro Bowl"
                  className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Price (₹ INR)
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-extrabold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                    Category
                  </label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  >
                    <option value="High Protein">High Protein</option>
                    <option value="Salads & Bowls">Salads & Bowls</option>
                    <option value="Breakfast">Breakfast</option>
                    <option value="Smoothies & Juices">Smoothies & Juices</option>
                    <option value="Healthy Snacks">Healthy Snacks</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Low Carb">Low Carb</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                  Preset Dish Photo
                </label>
                <select
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs mb-2"
                >
                  {PRESET_IMAGES.map((img, idx) => (
                    <option key={idx} value={img.url}>
                      {img.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--color-primary-light)] border border-[var(--color-border)] space-y-2">
                <span className="block text-xs font-black text-[var(--color-primary)] uppercase">
                  Nutrition Facts Per Serving
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)]">Calories (kcal)</label>
                    <input
                      type="number"
                      value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)]">Protein (g)</label>
                    <input
                      type="number"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-bold text-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)]">Carbs (g)</label>
                    <input
                      type="number"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)]">Fat (g)</label>
                    <input
                      type="number"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)]">Fiber (g)</label>
                    <input
                      type="number"
                      value={fiber}
                      onChange={(e) => setFiber(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)]">Prep Time</label>
                    <input
                      type="text"
                      value={prepTime}
                      onChange={(e) => setPrepTime(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe key fresh ingredients and dietitian formulation..."
                  rows={3}
                  className="w-full px-3.5 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-medium text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="popular-check"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-primary)] rounded cursor-pointer"
                />
                <label htmlFor="popular-check" className="text-xs font-bold text-[var(--color-text-main)] cursor-pointer">
                  Mark as "Popular" meal badge
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black text-sm hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md carved-btn"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>Publish Meal to Bro-Ko-Le</span>
              </button>
            </form>
          </div>

          {/* Active Product Catalog List Column */}
          <div className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <div>
                <h2 className="text-base font-black text-[var(--color-text-main)]">
                  Live Catalog Items ({products.length})
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Any changes here instantly reflect across Bro-Ko-Le storefront
                </p>
              </div>
              <button
                onClick={resetProducts}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Seed</span>
              </button>
            </div>

            <div className="space-y-3">
              {products.map((product: Product) => {
                const priceVal = parseFloat(product.priceRange.minVariantPrice.amount);
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-primary-muted)] transition-all carved-box"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={product.featuredImage.url}
                        alt={product.title}
                        className="w-14 h-14 rounded-2xl object-cover bg-white shrink-0 border border-[var(--color-border)]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-extrabold text-[var(--color-text-main)] truncate">
                            {product.title}
                          </h4>
                          {product.isPopular && (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-deal)] text-[var(--color-text-on-deal)] text-[9px] font-black uppercase">
                              POPULAR
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-primary)] font-bold mt-0.5">
                          {product.productType} • {product.nutrition.protein}g Protein • {product.nutrition.calories} kcal
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-medium">
                          Prep: {product.prepTime || '20 mins'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm sm:text-base font-black text-[var(--color-text-main)]">
                        {formatCurrency(priceVal)}
                      </span>
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.title)}
                        className="p-2 rounded-xl text-[var(--color-text-light)] hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        aria-label={`Delete ${product.title}`}
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: CUSTOMER DATA & TELEMETRY */}
      {activeTab === 'customers' && (
        <div className="space-y-8">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-card carved-box space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
              <div>
                <h2 className="text-base font-black text-[var(--color-text-main)] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--color-primary)]" />
                  <span>Customer Directory & Macro Telemetry ({filteredCustomers.length})</span>
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] font-medium">
                  Automatically recorded from customer signups, profile updates, and checkout orders
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-light)]" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Filter by name, phone, address..."
                    className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl text-xs font-bold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-border-focus)] shadow-xs"
                  />
                </div>

                <button
                  onClick={() => {
                    resetCustomers();
                    toast.info('Reset customer directory data');
                  }}
                  className="p-2 rounded-2xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
                  title="Reset Customers"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[var(--color-text-main)] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] uppercase text-[10px] font-black tracking-wider bg-[var(--color-surface-hover)]">
                    <th className="p-3 rounded-l-xl">Customer</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Primary Delivery Address</th>
                    <th className="p-3">Dietary Tags</th>
                    <th className="p-3 text-center">Orders</th>
                    <th className="p-3 text-right">Total Value</th>
                    <th className="p-3 text-center rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="p-3 font-extrabold flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center font-black text-xs">
                          {cust.name.charAt(0)}
                        </div>
                        <div>
                          <span>{cust.name}</span>
                          {cust.status === 'VIP' ? (
                            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[var(--color-accent-light)] text-[var(--color-text-on-accent)] text-[9px] font-black">
                              VIP
                            </span>
                          ) : cust.status === 'NEW' ? (
                            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-black">
                              NEW
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-[var(--color-text-muted)]">
                        <div>{cust.email}</div>
                        <div className="text-[10px] text-[var(--color-text-light)]">{cust.phone}</div>
                      </td>
                      <td className="p-3 font-medium text-[var(--color-text-muted)] max-w-xs truncate">
                        {cust.address}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {cust.dietary.map((d, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-bold">
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center font-extrabold">{cust.ordersCount}</td>
                      <td className="p-3 text-right font-black text-[var(--color-primary)]">
                        {formatCurrency(cust.totalSpent)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            deleteCustomerRecord(cust.id);
                            toast.info(`Deleted customer record for ${cust.name}`);
                          }}
                          className="p-1 rounded-lg text-[var(--color-text-light)] hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Customer Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
