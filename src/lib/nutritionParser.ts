export interface NutritionInfo {
  calories: number; // in kcal
  protein: number; // in grams
  carbs: number; // in grams
  fat: number; // in grams
  fiber: number; // in grams
}

export function parseNutritionFacts(description: string, defaults?: Partial<NutritionInfo>): NutritionInfo {
  const text = description || '';

  // Match pattern like "Protein: 42g" or "42g protein" or "Calories: 520"
  const extractValue = (pattern: RegExp): number | null => {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      return isNaN(val) ? null : val;
    }
    return null;
  };

  const calories =
    extractValue(/calories[:\s]*(\d+)/i) ??
    extractValue(/(\d+)\s*kcal/i) ??
    extractValue(/(\d+)\s*cal/i) ??
    defaults?.calories ??
    350;

  const protein =
    extractValue(/protein[:\s]*(\d+(?:\.\d+)?)\s*g?/i) ??
    extractValue(/(\d+(?:\.\d+)?)\s*g\s*protein/i) ??
    defaults?.protein ??
    25;

  const carbs =
    extractValue(/carbs[:\s]*(\d+(?:\.\d+)?)\s*g?/i) ??
    extractValue(/carbohydrates[:\s]*(\d+(?:\.\d+)?)\s*g?/i) ??
    extractValue(/(\d+(?:\.\d+)?)\s*g\s*carbs/i) ??
    defaults?.carbs ??
    30;

  const fat =
    extractValue(/fat[:\s]*(\d+(?:\.\d+)?)\s*g?/i) ??
    extractValue(/fats[:\s]*(\d+(?:\.\d+)?)\s*g?/i) ??
    extractValue(/(\d+(?:\.\d+)?)\s*g\s*fat/i) ??
    defaults?.fat ??
    10;

  const fiber =
    extractValue(/fiber[:\s]*(\d+(?:\.\d+)?)\s*g?/i) ??
    extractValue(/dietary fiber[:\s]*(\d+(?:\.\d+)?)\s*g?/i) ??
    extractValue(/(\d+(?:\.\d+)?)\s*g\s*fiber/i) ??
    defaults?.fiber ??
    5;

  return { calories, protein, carbs, fat, fiber };
}

export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  if (currencyCode === 'INR') {
    return `₹${Math.round(amount)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}
