# BrewTracker TypeScript Type Definitions

This directory contains comprehensive TypeScript type definitions for the BrewTracker application, providing type safety and improved developer experience throughout the codebase.

## Type Definition Files

### `common.ts`
Core utility types used across the application:
- `ID` - String-based identifier type
- `BaseEntity` - Base interface with common entity fields
- `ApiResponse<T>` - Generic API response wrapper
- `PaginatedResponse<T>` - Paginated API response
- `LoadingState` - Async operation states
- `AsyncState<T>` - State container for async operations

### `recipe.ts`
Recipe and ingredient-related types:
- `Recipe` - Main recipe interface with all properties
- `RecipeIngredient` - Ingredient within a recipe
- `Ingredient` - Base ingredient from ingredients collection
- `RecipeMetrics` - Calculated brewing metrics (OG, FG, ABV, IBU, SRM)
- `AvailableIngredients` - Grouped ingredients for UI dropdowns
- Various enums: `IngredientType`, `GrainType`, `HopUse`, etc.

### `api.ts`
API request/response type definitions:
- Authentication: `LoginRequest`, `RegisterRequest`, etc.
- Recipe operations: `CreateRecipeRequest`, `UpdateRecipeRequest`, etc.
- All API endpoints with proper request/response typing
- Generic API configuration and error types

### `beer-styles.ts`
Beer style guide and analysis types:
- `BeerStyleGuide` - BJCP style guide information
- `StyleRange` - Min/max ranges for style specifications
- `StyleAnalysis` - Recipe-to-style comparison results
- `StyleSuggestion` - Style matching recommendations

### `metrics.ts`
Brewing calculation and analysis types:
- `BrewingMetrics` - Core brewing calculations
- `ExtendedMetrics` - Additional calculated values
- `RecipeAnalysis` - Complete recipe breakdown
- Grain bill, hop schedule, and yeast analysis interfaces
- Calculation parameters and validation types

### `units.ts`
Unit system and conversion types:
- `UnitSystem` - Imperial vs Metric
- Unit type definitions: `WeightUnit`, `VolumeUnit`, etc.
- `UnitConversion` - Conversion result interface
- `UnitPreferences` - User unit preferences
- Measurement and formatting types

### `user.ts`
User account and authentication types:
- `User` - User account information
- `UserSettings` - User preferences and settings
- `AuthState` - Authentication state management
- Form data types for login, registration, profile updates
- JWT and session management types

### `brew-session.ts`
Brew session tracking types:
- `BrewSession` - Brewing session with measurements
- `FermentationEntry` - Individual fermentation data points
- `BrewSessionStatus` - Session state enum
- `FermentationStats` - Calculated fermentation statistics
- Timeline and analysis interfaces

## Usage Examples

### Basic Recipe Type Usage
```typescript
import { Recipe, RecipeMetrics, IngredientType } from '@/types';

const recipe: Recipe = {
  id: 'recipe-001',
  recipe_id: 'recipe-001',
  name: 'American IPA',
  batch_size: 5,
  batch_size_unit: 'gal',
  is_public: true,
  ingredients: [
    {
      ingredient_id: 'grain-001',
      name: 'Pale Malt',
      type: 'grain' as IngredientType,
      amount: 10,
      unit: 'lb'
    }
  ]
};
```

### API Call Typing
```typescript
import { ApiService } from '@/services';
import { RecipeResponse, CreateRecipeRequest } from '@/types';

const createRecipe = async (recipeData: CreateRecipeRequest): Promise<Recipe> => {
  const response: RecipeResponse = await ApiService.recipes.create(recipeData);
  return response.data;
};
```

### Unit Context Usage
```typescript
import { UnitSystem, UnitConversion } from '@/types';

const convertWeight = (value: number, fromUnit: string, toUnit: string): UnitConversion => {
  // Implementation with proper typing
  return { value: convertedValue, unit: toUnit };
};
```

## Type Safety Benefits

1. **Compile-time Error Detection**: Catch type mismatches before runtime
2. **IntelliSense Support**: Full autocomplete and documentation in IDEs
3. **Refactoring Safety**: Confidently rename and restructure code
4. **API Contract Enforcement**: Ensure frontend/backend data consistency
5. **Documentation**: Types serve as living documentation

## Migration Strategy

These types are designed to support gradual migration from JavaScript:

1. **Phase 1**: Use types in new components and services
2. **Phase 2**: Migrate core hooks and contexts (`useRecipeBuilder`, `UnitContext`)
3. **Phase 3**: Convert complex components (`SearchableSelect`, Recipe Builder)
4. **Phase 4**: Migrate remaining components and pages

## Naming Conventions

- **Interfaces**: PascalCase (e.g., `Recipe`, `BrewSession`)
- **Types/Enums**: PascalCase (e.g., `IngredientType`, `UnitSystem`)
- **Properties**: camelCase matching backend snake_case where appropriate
- **API Types**: Descriptive suffixes (`Request`, `Response`, `FormData`)

## Contributing

When adding new types:

1. Follow existing naming conventions
2. Add JSDoc comments for complex interfaces
3. Use generic types where appropriate
4. Ensure backward compatibility
5. Update this README with new type descriptions

## Related Files

- `tsconfig.json` - TypeScript configuration
- `frontend/src/services/` - Service layer implementations using these types
- `frontend/src/hooks/` - Custom hooks with type safety
- `frontend/src/contexts/` - React contexts with proper typing