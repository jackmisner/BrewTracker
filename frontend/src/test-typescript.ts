// Example usage of BrewTracker TypeScript definitions
import { Recipe, RecipeMetrics, IngredientType } from './types';

// Example recipe with proper typing
const exampleRecipe: Recipe = {
  id: 'recipe-123',
  recipe_id: 'recipe-123',
  name: 'American IPA',
  style: 'American IPA',
  batch_size: 5,
  batch_size_unit: 'gal',
  description: 'A hoppy American IPA with citrus notes',
  is_public: true,
  boil_time: 60,
  efficiency: 75,
  ingredients: [
    {
      ingredient_id: 'grain-001',
      name: 'Pale Malt',
      type: 'grain' as IngredientType,
      amount: 10,
      unit: 'lb',
      use: 'mash',
      potential: 1.037,
      color: 2
    },
    {
      ingredient_id: 'hop-001', 
      name: 'Cascade',
      type: 'hop' as IngredientType,
      amount: 1,
      unit: 'oz',
      use: 'boil',
      time: 60,
      alpha_acid: 5.5
    }
  ]
};

// Example metrics calculation
const calculateABV = (og: number, fg: number): number => {
  return (og - fg) * 131.25;
};

const exampleMetrics: RecipeMetrics = {
  og: 1.060,
  fg: 1.012,
  abv: calculateABV(1.060, 1.012),
  ibu: 45,
  srm: 8
};

// Test function demonstrating type safety
const validateRecipe = (recipe: Recipe): boolean => {
  return recipe.name.length > 0 && 
         recipe.batch_size > 0 && 
         recipe.ingredients.length > 0;
};

console.log('Recipe validation:', validateRecipe(exampleRecipe));
console.log('Calculated ABV:', exampleMetrics.abv.toFixed(1) + '%');