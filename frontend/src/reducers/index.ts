// Centralized exports for all reducers
export {
  recipeBuilderReducer,
  createInitialState,
  type RecipeBuilderAction,
  type RecipeBuilderState,
} from "./recipeBuilderReducer";

export {
  fermentationReducer,
  createInitialFermentationState,
  validateField,
  type FermentationAction,
  type FermentationState,
  type FormData,
  type ValidationResult,
} from "./fermentationReducer";

export {
  userSettingsReducer,
  createInitialUserSettingsState,
  type UserSettingsAction,
  type UserSettingsState,
  type ProfileForm,
  type PasswordForm,
  type DeleteForm,
  type PreferencesForm,
  type PrivacyForm,
  type TabId,
  type FullUserSettings,
} from "./userSettingsReducer";

export {
  ingredientManagerReducer,
  createInitialIngredientManagerState,
  type IngredientManagerAction,
  type IngredientManagerState,
  type IngredientFormData,
  type IngredientWithSearch,
  type GroupedIngredients,
  type ExpandedSections,
} from "./ingredientManagerReducer";

export {
  beerXMLReducer,
  createInitialBeerXMLState,
  type BeerXMLAction,
  type BeerXMLState,
} from "./beerXMLReducer";

export {
  aiSuggestionsReducer,
  createInitialAISuggestionsState,
  type AISuggestionsAction,
  type AISuggestionsState,
  type Suggestion,
  type IngredientChange,
  type OptimizationResult,
} from "./aiSuggestionsReducer";

export {
  brewSessionReducer,
  createInitialBrewSessionState,
  createInitialCreateFormData,
  createInitialEditFormData,
  type BrewSessionAction,
  type BrewSessionState,
  type CreateBrewSessionFormData,
  type EditBrewSessionFormData,
} from "./brewSessionReducer";