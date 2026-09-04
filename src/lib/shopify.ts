import { NutritionInfo } from './nutritionParser';
import { fetchMenu, fetchMenuItemBySlug } from './menu';
import { isApiConfigured } from './api';

export interface ProductVariant {
  id: string;
  title: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale: boolean;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
  tags: string[];
  featuredImage: {
    url: string;
    altText: string;
  };
  images: Array<{
    url: string;
    altText: string;
  }>;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: ProductVariant[];
  nutrition: NutritionInfo;
  prepTime: string;
  isPopular?: boolean;
  isAvailable?: boolean;
}

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      id: string;
      title: string;
      handle: string;
      featuredImage: {
        url: string;
        altText: string;
      };
    };
    price: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
  lines: ShopifyCartLine[];
}

// Fallback seed meals if Storefront API is unconfigured or returns empty
export const SAMPLE_PRODUCTS: Product[] = [
  // Grain & Protein Bowls
  {
    id: 'gid://shopify/Product/201',
    handle: 'quinoa-paneer-bowl',
    title: 'Quinoa Paneer Bowl',
    productType: 'Grain & Protein Bowls',
    tags: ['Grain & Protein Bowls', 'High Protein', 'Vegetarian', 'Healthy'],
    description: 'Grilled chicken & paneer, roasted seasonal veg, tahini drizzle\n\nCalories: 460 kcal | Protein: 32g | Carbs: 45g | Fat: 15g',
    featuredImage: {
      url: '/images/quinoa_paneer_bowl.png',
      altText: 'Quinoa Paneer Bowl',
    },
    images: [{ url: '/images/quinoa_paneer_bowl.png', altText: 'Quinoa Paneer Bowl' }],
    priceRange: { minVariantPrice: { amount: '160', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2011', title: 'Small Portion', price: { amount: '160', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2012', title: 'Medium Portion', price: { amount: '199', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2013', title: 'Large Portion', price: { amount: '240', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 460, protein: 32, carbs: 45, fat: 15, fiber: 8 },
    prepTime: '20-25 mins',
    isPopular: true,
  },
  {
    id: 'gid://shopify/Product/202',
    handle: 'grilled-chicken-brown-rice',
    title: 'Grilled Chicken & Brown Rice',
    productType: 'Grain & Protein Bowls',
    tags: ['Grain & Protein Bowls', 'High Protein', 'Chef Special'],
    description: 'Char-grilled chicken breast, herbed brown rice, greens\n\nCalories: 520 kcal | Protein: 38g | Carbs: 45g | Fat: 12g',
    featuredImage: {
      url: '/images/grilled_chicken_brown_rice.png',
      altText: 'Grilled Chicken & Brown Rice',
    },
    images: [{ url: '/images/grilled_chicken_brown_rice.png', altText: 'Grilled Chicken & Brown Rice' }],
    priceRange: { minVariantPrice: { amount: '180', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2021', title: 'Small Portion', price: { amount: '180', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2022', title: 'Medium Portion', price: { amount: '215', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2023', title: 'Large Portion', price: { amount: '245', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 520, protein: 38, carbs: 45, fat: 12, fiber: 6 },
    prepTime: '20-25 mins',
    isPopular: true,
  },
  {
    id: 'gid://shopify/Product/203',
    handle: 'paneer-tikka-millet-bowl',
    title: 'Paneer Tikka Millet Bowl',
    productType: 'Grain & Protein Bowls',
    tags: ['Grain & Protein Bowls', 'High Protein', 'Vegetarian'],
    description: 'Low fat paneer, foxtail millet, mint chutney\n\nCalories: 480 kcal | Protein: 26g | Carbs: 48g | Fat: 16g',
    featuredImage: {
      url: '/images/paneer_tikka_millet.png',
      altText: 'Paneer Tikka Millet Bowl',
    },
    images: [{ url: '/images/paneer_tikka_millet.png', altText: 'Paneer Tikka Millet Bowl' }],
    priceRange: { minVariantPrice: { amount: '165', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2031', title: 'Small Portion', price: { amount: '165', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2032', title: 'Medium Portion', price: { amount: '200', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2033', title: 'Large Portion', price: { amount: '235', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 480, protein: 26, carbs: 48, fat: 16, fiber: 7 },
    prepTime: '20-25 mins',
  },
  {
    id: 'gid://shopify/Product/204',
    handle: 'sprouts-peanut-bowl',
    title: 'Sprouts & Peanut Bowl',
    productType: 'Grain & Protein Bowls',
    tags: ['Grain & Protein Bowls', 'Vegan', 'High Fiber'],
    description: 'Moong sprouts, roasted peanut, lime, chili\n\nCalories: 380 kcal | Protein: 18g | Carbs: 36g | Fat: 14g',
    featuredImage: {
      url: '/images/sprouts_peanut_bowl.png',
      altText: 'Sprouts & Peanut Bowl',
    },
    images: [{ url: '/images/sprouts_peanut_bowl.png', altText: 'Sprouts & Peanut Bowl' }],
    priceRange: { minVariantPrice: { amount: '155', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2041', title: 'Regular Portion', price: { amount: '155', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2042', title: 'Large Portion', price: { amount: '199', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 380, protein: 18, carbs: 36, fat: 14, fiber: 9 },
    prepTime: '15 mins',
  },
  {
    id: 'gid://shopify/Product/216',
    handle: 'mediterranean-chicken-hummus-bowl',
    title: 'Mediterranean Chicken & Hummus Bowl',
    productType: 'Grain & Protein Bowls',
    tags: ['Grain & Protein Bowls', 'High Protein', 'Chef Special', 'Healthy'],
    description: 'Creamy house hummus, grilled chicken breast, quinoa, cucumber, cherry tomatoes, olives, tahini drizzle\n\nCalories: 450 kcal | Protein: 36g | Carbs: 42g | Fat: 14g',
    featuredImage: {
      url: '/images/hummus_bowl.png',
      altText: 'Mediterranean Chicken & Hummus Bowl',
    },
    images: [{ url: '/images/hummus_bowl.png', altText: 'Mediterranean Chicken & Hummus Bowl' }],
    priceRange: { minVariantPrice: { amount: '160', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2161', title: 'Small Portion', price: { amount: '160', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2162', title: 'Medium Portion', price: { amount: '199', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2163', title: 'Large Portion', price: { amount: '235', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 450, protein: 36, carbs: 42, fat: 14, fiber: 7 },
    prepTime: '15-20 mins',
    isPopular: true,
  },
  {
    id: 'gid://shopify/Product/217',
    handle: 'protein-oats-pancakes',
    title: 'Protein Oats & Honey Pancakes',
    productType: 'Breakfast',
    tags: ['Breakfast', 'High Protein', 'Chef Special'],
    description: 'Fluffy oat flour pancakes, whey protein & pure raw honey\n\nCalories: 380 kcal | Protein: 28g | Carbs: 48g | Fat: 8g',
    featuredImage: {
      url: '/images/protein_pancakes.png',
      altText: 'Protein Oats & Honey Pancakes',
    },
    images: [{ url: '/images/protein_pancakes.png', altText: 'Protein Oats & Honey Pancakes' }],
    priceRange: { minVariantPrice: { amount: '149', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2171', title: 'Standard Stack (3 Pancakes)', price: { amount: '149', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2172', title: 'Double Protein Stack (5 Pancakes)', price: { amount: '189', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 410, protein: 28, carbs: 46, fat: 10, fiber: 6 },
    prepTime: '15 mins',
    isPopular: true,
  },

  // Wraps
  {
    id: 'gid://shopify/Product/205',
    handle: 'hummus-veg-wrap',
    title: 'Hummus & Veg Wrap',
    productType: 'Wraps',
    tags: ['Wraps', 'Vegan', 'Healthy Snacks'],
    description: 'Whole wheat wrap, hummus, crispy vegetables\n\nCalories: 360 kcal | Protein: 12g | Carbs: 44g | Fat: 14g',
    featuredImage: {
      url: '/images/hummus_veg_wrap.png',
      altText: 'Hummus & Veg Wrap',
    },
    images: [{ url: '/images/hummus_veg_wrap.png', altText: 'Hummus & Veg Wrap' }],
    priceRange: { minVariantPrice: { amount: '150', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2051', title: 'Small Wrap', price: { amount: '150', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2052', title: 'Large Wrap', price: { amount: '195', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 360, protein: 12, carbs: 44, fat: 14, fiber: 6 },
    prepTime: '15 mins',
  },
  {
    id: 'gid://shopify/Product/206',
    handle: 'grilled-chicken-wrap',
    title: 'Grilled Chicken Wrap',
    productType: 'Wraps',
    tags: ['Wraps', 'High Protein', 'Chef Special'],
    description: 'Grilled chicken, slaw, mustard yogurt\n\nCalories: 450 kcal | Protein: 32g | Carbs: 36g | Fat: 12g',
    featuredImage: {
      url: '/images/grilled_chicken_wrap.png',
      altText: 'Grilled Chicken Wrap',
    },
    images: [{ url: '/images/grilled_chicken_wrap.png', altText: 'Grilled Chicken Wrap' }],
    priceRange: { minVariantPrice: { amount: '175', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2061', title: 'Small Wrap', price: { amount: '175', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2062', title: 'Large Wrap', price: { amount: '225', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 450, protein: 32, carbs: 36, fat: 12, fiber: 4 },
    prepTime: '15-20 mins',
    isPopular: true,
  },
  {
    id: 'gid://shopify/Product/207',
    handle: 'egg-white-avocado-wrap',
    title: 'Egg White & Avocado Wrap',
    productType: 'Wraps',
    tags: ['Wraps', 'High Protein', 'Breakfast'],
    description: 'Egg white scramble, avocado mash, spinach\n\nCalories: 390 kcal | Protein: 22g | Carbs: 32g | Fat: 16g',
    featuredImage: {
      url: '/images/egg_white_avocado_wrap.png',
      altText: 'Egg White & Avocado Wrap',
    },
    images: [{ url: '/images/egg_white_avocado_wrap.png', altText: 'Egg White & Avocado Wrap' }],
    priceRange: { minVariantPrice: { amount: '160', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2071', title: 'Small Wrap', price: { amount: '160', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2072', title: 'Large Wrap', price: { amount: '205', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 390, protein: 22, carbs: 32, fat: 16, fiber: 5 },
    prepTime: '15 mins',
  },
  {
    id: 'gid://shopify/Product/208',
    handle: 'paneer-tikka-wrap',
    title: 'Paneer Tikka Wrap',
    productType: 'Wraps',
    tags: ['Wraps', 'Vegetarian', 'High Protein'],
    description: 'Grilled paneer, onion, mint chutney\n\nCalories: 430 kcal | Protein: 20g | Carbs: 38g | Fat: 18g',
    featuredImage: {
      url: '/images/paneer_tikka_wrap.png',
      altText: 'Paneer Tikka Wrap',
    },
    images: [{ url: '/images/paneer_tikka_wrap.png', altText: 'Paneer Tikka Wrap' }],
    priceRange: { minVariantPrice: { amount: '170', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2081', title: 'Small Wrap', price: { amount: '170', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2082', title: 'Large Wrap', price: { amount: '215', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 430, protein: 20, carbs: 38, fat: 18, fiber: 4 },
    prepTime: '15-20 mins',
  },

  // Smoothies & Juices
  {
    id: 'gid://shopify/Product/209',
    handle: 'green-detox-smoothie',
    title: 'Green Detox',
    productType: 'Smoothies & Juices',
    tags: ['Smoothies & Juices', 'Vegan', 'Low Carb', 'Detox'],
    description: 'Spinach, apple, cucumber, lemon\n\nCalories: 170 kcal | Protein: 4g | Carbs: 34g | Fat: 2g',
    featuredImage: {
      url: '/images/green_detox_smoothie.png',
      altText: 'Green Detox Smoothie',
    },
    images: [{ url: '/images/green_detox_smoothie.png', altText: 'Green Detox Smoothie' }],
    priceRange: { minVariantPrice: { amount: '110', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2091', title: '300ml Glass Jar', price: { amount: '110', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2092', title: '500ml Bottle', price: { amount: '140', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 170, protein: 4, carbs: 34, fat: 2, fiber: 5 },
    prepTime: '10 mins',
  },
  {
    id: 'gid://shopify/Product/210',
    handle: 'berry-protein-smoothie',
    title: 'Berry Protein Smoothie',
    productType: 'Smoothies & Juices',
    tags: ['Smoothies & Juices', 'High Protein', 'Post-Workout'],
    description: 'Mixed berries, whey, almond milk\n\nCalories: 290 kcal | Protein: 26g | Carbs: 28g | Fat: 6g',
    featuredImage: {
      url: '/images/berry_protein_smoothie.png',
      altText: 'Berry Protein Smoothie',
    },
    images: [{ url: '/images/berry_protein_smoothie.png', altText: 'Berry Protein Smoothie' }],
    priceRange: { minVariantPrice: { amount: '125', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2101', title: '300ml Glass Jar', price: { amount: '125', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2102', title: '500ml Bottle', price: { amount: '149', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 290, protein: 26, carbs: 28, fat: 6, fiber: 4 },
    prepTime: '10 mins',
    isPopular: true,
  },
  {
    id: 'gid://shopify/Product/211',
    handle: 'peanut-butter-banana-smoothie',
    title: 'Peanut Butter Banana Smoothie',
    productType: 'Smoothies & Juices',
    tags: ['Smoothies & Juices', 'High Protein', 'Energy'],
    description: 'Banana, peanut butter, oats, milk\n\nCalories: 350 kcal | Protein: 18g | Carbs: 42g | Fat: 14g',
    featuredImage: {
      url: '/images/peanut_butter_banana.png',
      altText: 'Peanut Butter Banana Smoothie',
    },
    images: [{ url: '/images/peanut_butter_banana.png', altText: 'Peanut Butter Banana Smoothie' }],
    priceRange: { minVariantPrice: { amount: '120', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2111', title: '300ml Glass Jar', price: { amount: '120', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2112', title: '500ml Bottle', price: { amount: '145', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 350, protein: 18, carbs: 42, fat: 14, fiber: 6 },
    prepTime: '10 mins',
  },
  {
    id: 'gid://shopify/Product/212',
    handle: 'cold-pressed-abc-juice',
    title: 'Cold-Pressed ABC Juice',
    productType: 'Smoothies & Juices',
    tags: ['Smoothies & Juices', 'Vegan', 'Detox'],
    description: 'Apple, beetroot, carrot\n\nCalories: 140 kcal | Protein: 2g | Carbs: 30g | Fat: 1g',
    featuredImage: {
      url: '/images/cold_pressed_abc_juice.png',
      altText: 'Cold-Pressed ABC Juice',
    },
    images: [{ url: '/images/cold_pressed_abc_juice.png', altText: 'Cold-Pressed ABC Juice' }],
    priceRange: { minVariantPrice: { amount: '105', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2121', title: '300ml Glass Bottle', price: { amount: '105', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2122', title: '500ml Glass Bottle', price: { amount: '135', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 140, protein: 2, carbs: 30, fat: 1, fiber: 4 },
    prepTime: '10 mins',
  },

  // Salads
  {
    id: 'gid://shopify/Product/213',
    handle: 'mediterranean-chicken-salad',
    title: 'Mediterranean Chicken Salad',
    productType: 'Salads & Bowls',
    tags: ['Salads & Bowls', 'High Protein', 'Healthy'],
    description: 'Grilled chicken breast, cucumber, feta, cherry tomatoes, lemon dressing\n\nCalories: 340 kcal | Protein: 34g | Carbs: 18g | Fat: 14g',
    featuredImage: {
      url: '/images/mediterranean_chicken.png',
      altText: 'Mediterranean Chicken Salad',
    },
    images: [{ url: '/images/mediterranean_chicken.png', altText: 'Mediterranean Chicken Salad' }],
    priceRange: { minVariantPrice: { amount: '155', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2131', title: 'Small Salad', price: { amount: '155', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2132', title: 'Large Salad', price: { amount: '199', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 340, protein: 34, carbs: 18, fat: 14, fiber: 5 },
    prepTime: '15 mins',
  },
  {
    id: 'gid://shopify/Product/214',
    handle: 'grilled-chicken-caesar-lite',
    title: 'Grilled Chicken Caesar (Lite)',
    productType: 'Salads & Bowls',
    tags: ['Salads & Bowls', 'High Protein', 'Low Carb'],
    description: 'Grilled chicken, romaine, yogurt dressing\n\nCalories: 390 kcal | Protein: 36g | Carbs: 16g | Fat: 14g',
    featuredImage: {
      url: '/images/grilled_chicken_caesar.png',
      altText: 'Grilled Chicken Caesar (Lite)',
    },
    images: [{ url: '/images/grilled_chicken_caesar.png', altText: 'Grilled Chicken Caesar (Lite)' }],
    priceRange: { minVariantPrice: { amount: '180', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2141', title: 'Small Salad', price: { amount: '180', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2142', title: 'Large Salad', price: { amount: '230', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 390, protein: 36, carbs: 16, fat: 14, fiber: 3 },
    prepTime: '15-20 mins',
    isPopular: true,
  },
  {
    id: 'gid://shopify/Product/215',
    handle: 'sprout-feta-salad',
    title: 'Sprout & Feta Salad',
    productType: 'Salads & Bowls',
    tags: ['Salads & Bowls', 'Vegetarian', 'High Fiber'],
    description: 'Mixed sprouts, feta, cherry tomato, olive oil\n\nCalories: 320 kcal | Protein: 16g | Carbs: 28g | Fat: 14g',
    featuredImage: {
      url: '/images/sprouts_peanut_bowl.png',
      altText: 'Sprout & Feta Salad',
    },
    images: [{ url: '/images/sprouts_peanut_bowl.png', altText: 'Sprout & Feta Salad' }],
    priceRange: { minVariantPrice: { amount: '160', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2151', title: 'Small Salad', price: { amount: '160', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2152', title: 'Large Salad', price: { amount: '205', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 320, protein: 16, carbs: 28, fat: 14, fiber: 7 },
    prepTime: '15 mins',
  },
  {
    id: 'gid://shopify/Product/216',
    handle: 'fresh-mix-cut-fruit-bowl',
    title: 'Fresh Mix Cut Fruit Bowl',
    productType: 'Snacks & Sides',
    tags: ['Snacks & Sides', 'Healthy', 'Low Calorie', 'Fresh Fruit'],
    description: 'Freshly sliced seasonal organic fruits (kiwi, red watermelon, golden pineapple, papaya & pomegranate). Packed with natural vitamins & hydration.\n\nCalories: 120 kcal | Protein: 3g | Carbs: 28g | Fat: 0.5g',
    featuredImage: {
      url: '/images/mix_fruit_bowl.png',
      altText: 'Fresh Mix Cut Fruit Bowl',
    },
    images: [{ url: '/images/mix_fruit_bowl.png', altText: 'Fresh Mix Cut Fruit Bowl' }],
    priceRange: { minVariantPrice: { amount: '85', currencyCode: 'INR' } },
    variants: [
      { id: 'gid://shopify/ProductVariant/2161', title: 'Regular Bowl (250g)', price: { amount: '85', currencyCode: 'INR' }, availableForSale: true },
      { id: 'gid://shopify/ProductVariant/2162', title: 'Large Bowl (400g)', price: { amount: '99', currencyCode: 'INR' }, availableForSale: true },
    ],
    nutrition: { calories: 120, protein: 3, carbs: 28, fat: 0.5, fiber: 5 },
    prepTime: 'Fresh Prep',
  },
];

const SHOPIFY_STORE_DOMAIN = (import.meta as any).env?.VITE_SHOPIFY_STORE_DOMAIN || '';
const SHOPIFY_STOREFRONT_TOKEN = (import.meta as any).env?.VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN || '';
const API_VERSION = '2025-07';

async function shopifyFetch<T>(query: string, variables: Record<string, any> = {}): Promise<T | null> {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
    return null;
  }

  const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      console.error('Shopify GraphQL request failed:', res.statusText);
      return null;
    }

    const json = await res.json();
    if (json.errors) {
      console.error('Shopify GraphQL errors:', json.errors);
      return null;
    }
    return json.data;
  } catch (err) {
    console.error('Shopify fetch exception:', err);
    return null;
  }
}

export async function fetchProducts(): Promise<Product[]> {
  if (isApiConfigured) {
    const apiProducts = await fetchMenu();
    if (apiProducts.length > 0) return apiProducts;
  }

  const query = `
    query getProducts {
      products(first: 20) {
        edges {
          node {
            id
            handle
            title
            description
            productType
            tags
            featuredImage {
              url
              altText
            }
            images(first: 5) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<any>(query);

  if (!data || !data.products || !data.products.edges || data.products.edges.length === 0) {
    return SAMPLE_PRODUCTS;
  }

  return data.products.edges.map(({ node }: any) => {
    const images = node.images?.edges?.map((e: any) => e.node) || [];
    const variants = node.variants?.edges?.map((e: any) => e.node) || [];

    // Parse nutrition facts from description
    const text = node.description || '';
    const caloriesMatch = text.match(/calories[:\s]*(\d+)/i);
    const proteinMatch = text.match(/protein[:\s]*(\d+)g?/i);
    const carbsMatch = text.match(/carbs[:\s]*(\d+)g?/i);
    const fatMatch = text.match(/fat[:\s]*(\d+)g?/i);

    return {
      id: node.id,
      handle: node.handle,
      title: node.title,
      description: node.description,
      productType: node.productType || 'Healthy Meal',
      tags: node.tags || [],
      featuredImage: node.featuredImage || {
        url: images[0]?.url || '/images/grilled_chicken_bowl.png',
        altText: node.title,
      },
      images: images.length > 0 ? images : [{ url: '/images/grilled_chicken_bowl.png', altText: node.title }],
      priceRange: node.priceRange,
      variants: variants,
      nutrition: {
        calories: caloriesMatch ? parseInt(caloriesMatch[1]) : 380,
        protein: proteinMatch ? parseInt(proteinMatch[1]) : 30,
        carbs: carbsMatch ? parseInt(carbsMatch[1]) : 35,
        fat: fatMatch ? parseInt(fatMatch[1]) : 12,
        fiber: 6,
      },
      prepTime: '20-25 mins',
    };
  });
}

export async function fetchProductByHandle(handle: string): Promise<Product | null> {
  if (isApiConfigured) {
    const apiProduct = await fetchMenuItemBySlug(handle);
    if (apiProduct) return apiProduct;
  }

  const query = `
    query getProduct($handle: String!) {
      product(handle: $handle) {
        id
        handle
        title
        description
        productType
        tags
        featuredImage {
          url
          altText
        }
        images(first: 5) {
          edges {
            node {
              url
              altText
            }
          }
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 10) {
          edges {
            node {
              id
              title
              availableForSale
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<any>(query, { handle });

  if (data && data.product) {
    const node = data.product;
    const images = node.images?.edges?.map((e: any) => e.node) || [];
    const variants = node.variants?.edges?.map((e: any) => e.node) || [];

    const text = node.description || '';
    const caloriesMatch = text.match(/calories[:\s]*(\d+)/i);
    const proteinMatch = text.match(/protein[:\s]*(\d+)g?/i);
    const carbsMatch = text.match(/carbs[:\s]*(\d+)g?/i);
    const fatMatch = text.match(/fat[:\s]*(\d+)g?/i);

    return {
      id: node.id,
      handle: node.handle,
      title: node.title,
      description: node.description,
      productType: node.productType || 'Healthy Meal',
      tags: node.tags || [],
      featuredImage: node.featuredImage || {
        url: images[0]?.url || '/images/grilled_chicken_bowl.png',
        altText: node.title,
      },
      images: images.length > 0 ? images : [{ url: '/images/grilled_chicken_bowl.png', altText: node.title }],
      priceRange: node.priceRange,
      variants: variants,
      nutrition: {
        calories: caloriesMatch ? parseInt(caloriesMatch[1]) : 380,
        protein: proteinMatch ? parseInt(proteinMatch[1]) : 30,
        carbs: carbsMatch ? parseInt(carbsMatch[1]) : 35,
        fat: fatMatch ? parseInt(fatMatch[1]) : 12,
        fiber: 6,
      },
      prepTime: '20-25 mins',
    };
  }

  // Fallback to matching sample product
  const found = SAMPLE_PRODUCTS.find((p) => p.handle === handle);
  return found || null;
}

// Shopify Cart GraphQL Operations (cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove)
export async function createShopifyCart(lines: Array<{ merchandiseId: string; quantity: number }>): Promise<ShopifyCart | null> {
  const mutation = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price { amount currencyCode }
                    product {
                      id
                      title
                      handle
                      featuredImage { url altText }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<any>(mutation, { input: { lines } });
  if (!data || !data.cartCreate || !data.cartCreate.cart) {
    return null;
  }

  const cart = data.cartCreate.cart;
  return formatCartResponse(cart);
}

export async function addShopifyCartLines(cartId: string, lines: Array<{ merchandiseId: string; quantity: number }>): Promise<ShopifyCart | null> {
  const mutation = `
    mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price { amount currencyCode }
                    product {
                      id
                      title
                      handle
                      featuredImage { url altText }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<any>(mutation, { cartId, lines });
  if (!data || !data.cartLinesAdd || !data.cartLinesAdd.cart) {
    return null;
  }
  return formatCartResponse(data.cartLinesAdd.cart);
}

export async function updateShopifyCartLines(cartId: string, lines: Array<{ id: string; quantity: number }>): Promise<ShopifyCart | null> {
  const mutation = `
    mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price { amount currencyCode }
                    product {
                      id
                      title
                      handle
                      featuredImage { url altText }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<any>(mutation, { cartId, lines });
  if (!data || !data.cartLinesUpdate || !data.cartLinesUpdate.cart) {
    return null;
  }
  return formatCartResponse(data.cartLinesUpdate.cart);
}

export async function removeShopifyCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart | null> {
  const mutation = `
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price { amount currencyCode }
                    product {
                      id
                      title
                      handle
                      featuredImage { url altText }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch<any>(mutation, { cartId, lineIds });
  if (!data || !data.cartLinesRemove || !data.cartLinesRemove.cart) {
    return null;
  }
  return formatCartResponse(data.cartLinesRemove.cart);
}

function formatCartResponse(cart: any): ShopifyCart {
  const lines = cart.lines?.edges?.map((e: any) => e.node) || [];
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines,
  };
}
