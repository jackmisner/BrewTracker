# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React)

- **Start development server**: `cd frontend && npm start`
- **Build for production**: `cd frontend && npm run build`
- **Run tests**: `cd frontend && npm test`
- **Run tests with coverage**: `cd frontend && npm run coverage`
- **Test location**: `frontend/tests/`

### Backend (Flask)

- **Start development server**: `cd backend && flask run`
- **Run tests**: `cd backend && pytest`
- **Run tests with coverage**: `cd backend && pytest --cov`
- **Test location**: `backend/tests/`
- **Activate virtual environment**: `cd backend && source venv/bin/activate`

### Database Setup

- **Start MongoDB**: `brew services start mongodb-community`
- **MongoDB shell**: `mongosh`
- **Database name**: `brewtracker`
- **Test database**: Uses in-memory MongoDB via mongomock for tests

## Architecture Overview

### Full-Stack Structure

BrewTracker is a homebrewing management application with a React frontend and Flask backend:

- **Frontend**: React 19 with React Router, Axios for API calls, Fuse.js for fuzzy search
- **Backend**: Flask with MongoEngine ORM, JWT authentication, MongoDB database
- **Key Features**: Brewing calculation engine with metric/imperial unit conversion, yeast attenuation analytics

### Core Business Logic

#### Calculation System

- **Core calculations**: `backend/utils/brewing_calculation_core.py` - Core brewing formulas (OG, FG, ABV, IBU, SRM)
- **ORM calculator**: `backend/utils/recipe_orm_calculator.py` - Calculations for database models
- **API calculator**: `backend/utils/recipe_api_calculator.py` - Calculations for API preview requests
- **Unit conversions**: `backend/utils/unit_conversions.py` - Metric/imperial conversions

#### Data Models

- **MongoDB models**: `backend/models/mongo_models.py` - User, Recipe, Ingredient, BrewSession, BeerStyleGuide
- **Database service**: `backend/services/mongodb_service.py` - MongoDB interaction layer
- **Yeast Analytics**: Extended Ingredient model with attenuation tracking fields (`min_attenuation`, `max_attenuation`, `avg_attenuation`, `attenuation_data_points`)

#### Frontend Architecture

- **Unit context**: `frontend/src/contexts/UnitContext.ts` - Global metric/imperial preference management (TypeScript)
- **Service layer**: `frontend/src/services/` - Fully TypeScript API abstractions for different domains
- **Custom hooks**: `frontend/src/hooks/useRecipeBuilder.ts` - Complex recipe state management (TypeScript)
- **Fuzzy search**: `frontend/src/components/SearchableSelect.tsx` - Fuse.js-powered ingredient search (TypeScript)
- **Recipe UI**: `frontend/src/components/CompactRecipeCard.tsx` - Unified recipe display component with SRM color swatches and metrics

#### Service Architecture Guidelines

**IMPORTANT**: BrewTracker uses a centralized service architecture that must be followed for all new development:

##### Service Organization Structure
- **Analytics/**: AttenuationAnalyticsService, MetricService
- **Data/**: IngredientService, BeerStyleService, RecipeService  
- **User/**: UserSettingsService, RecipeDefaultsService
- **Brewing/**: BrewSessionService
- **AI/**: CascadingEffectsService, EnhancedStyleComplianceService, SmartBaseMaltService
- **BeerXML/**: BeerXMLService, IngredientMatchingService

##### Mandatory Service Import Pattern
- **✅ ALWAYS USE**: `import { Services } from "../services"` in components/hooks/contexts
- **✅ THEN ACCESS**: `Services.Data.ingredient`, `Services.AI.cascadingEffects`, etc.
- **❌ NEVER USE**: Direct service imports like `import SomeService from "../services/SomeService"`

##### New Service Creation Requirements
1. **Place in appropriate subfolder**: Choose correct domain (Analytics/, Data/, User/, etc.)
2. **Add to services/index.ts**: Update both grouped `Services` object AND legacy flat exports
3. **Export types separately**: Add shared interfaces to `frontend/src/types/` directory
4. **Update tests**: Mock through `Services` object, never mock individual service files

##### Type Organization
- **Service interfaces**: Place in `frontend/src/types/ai.ts`, `frontend/src/types/recipe.ts`, etc.
- **Service files**: Only contain business logic, import types from `/types` directory
- **Components**: Import types from main types or use `import type { Type } from "../types/specific"`

**Enforcement**: All PRs must follow this architecture. Code reviews will reject direct service imports.

### Key Features

- **Recipe Builder**: Complex multi-ingredient recipe creation with real-time calculations
- **Brew Sessions**: Track fermentation progress and brewing notes
- **BeerXML**: Import/export recipes in standard format
- **Beer Style Analysis**: Compare recipes against BJCP style guidelines
- **Public/Private Recipes**: Recipe sharing system with unified compact card design and access control
- **Version Control**: Recipe cloning with parent-child relationships
- **Yeast Attenuation Analytics**: Real-world yeast performance tracking with min/max/average attenuation rates (implementation complete, pending real-world data)
- **Advanced Recipe Browsing**: Fuzzy search and comprehensive sorting (14 criteria) for both personal and public recipes

### Testing Strategy

- **Frontend**: Jest with React Testing Library, custom test utilities in `frontend/tests/testUtils.js`
- **Backend**: pytest with mongomock for database isolation, comprehensive fixtures in `backend/tests/conftest.py`
- **Coverage**: Both frontend and backend have coverage reporting configured

### Environment Variables

- **Frontend**: `REACT_APP_API_URL` for backend connection
- **Backend**: `MONGO_URI`, `JWT_SECRET_KEY`, `FLASK_APP`, `FLASK_ENV`

### Data Seeding

- **Ingredients**: Auto-seeded from `backend/data/brewtracker.ingredients.json` on first run
- **Beer styles**: Auto-seeded from `backend/data/beer_style_guides.json` on first run

## Public Recipe Access Control System

### Implementation Status: Production Ready ✅

The public recipe access control system has been fully implemented to provide proper access control and attribution for shared recipes. This feature ensures users can only clone public recipes (not edit or delete them) and creates unlinked copies with proper attribution.

### Frontend Implementation

#### Components
- **RecipeActions**: `frontend/src/components/RecipeActions.tsx` - Updated with public recipe mode support
  - Added `isPublicRecipe` and `originalAuthor` props for conditional behavior
  - Conditionally hides Edit and Delete buttons for public recipes
  - Uses `clonePublic` API for public recipes with attribution
  - Maintains full functionality for private recipes

- **PublicRecipes**: `frontend/src/pages/PublicRecipes.tsx` - Integrated with RecipeActions component
  - Replaced custom clone buttons with unified RecipeActions component
  - Passes public recipe context (`isPublicRecipe={true}`) and author information
  - Maintains existing search, filter, and pagination functionality

- **CompactRecipeCard**: `frontend/src/components/CompactRecipeCard.tsx` - Enhanced action filtering
  - Added `showActionsInCard` prop to conditionally render internal action buttons
  - Supports external action components like RecipeActions for flexible UI composition

#### API Services
- **ApiService**: `frontend/src/services/api.ts` - Extended with public recipe cloning
  - Added `clonePublic` method: `(id: ID, originalAuthor: string) => Promise<AxiosResponse<ClonePublicRecipeResponse>>`
  - Comprehensive TypeScript interfaces for all public recipe operations
  - Full type safety and error handling

#### Type Definitions
- **API Types**: `frontend/src/types/api.ts` - Extended with public recipe interfaces
  - `ClonePublicRecipeResponse` for API response handling
  - Proper typing for all public recipe operations

### Backend Integration

The frontend is designed to work with backend endpoints that support:
- `POST /api/recipes/{id}/clone-public` - Create unlinked copy with attribution
- Attribution system that adds original author information to recipe notes
- Proper access control validation on the backend

### Key Features

#### Access Control
- **View Access**: All users can view public recipes
- **Clone Access**: All users can clone public recipes with attribution
- **Edit/Delete Restriction**: Only recipe owners can edit/delete (public recipes hide these buttons)
- **Unlinked Cloning**: Public recipe clones create independent copies (no parent-child relationship)

#### Attribution System
- **Automatic Attribution**: Original author information automatically added to cloned recipe notes
- **User Feedback**: Success messages include attribution information
- **Data Preservation**: Original author context preserved in the cloning process

#### UI/UX Consistency
- **Unified Actions**: Uses same RecipeActions component across personal and public recipe pages
- **Conditional Rendering**: Context-aware button visibility (Edit/Delete hidden for public recipes)
- **Consistent Styling**: Maintains design consistency between private and public recipe interfaces

### Technical Implementation Details

#### Component Props
```typescript
interface RecipeActionsProps {
  recipe: Recipe;
  onDelete?: (recipeId: string) => void;
  refreshTrigger?: () => void;
  showViewButton?: boolean;
  compact?: boolean;
  isPublicRecipe?: boolean;        // New: Enables public recipe mode
  originalAuthor?: string;         // New: Original recipe author for attribution
}
```

#### API Method
```typescript
clonePublic: (id: ID, originalAuthor: string): Promise<AxiosResponse<ClonePublicRecipeResponse>> => 
  api.post(`/recipes/${id}/clone-public`, { originalAuthor }),
```

#### Clone Logic
```typescript
// In RecipeActions component
if (isPublicRecipe && originalAuthor) {
  response = await ApiService.recipes.clonePublic(recipe.recipe_id, originalAuthor);
  alert(`Recipe cloned successfully with attribution to ${originalAuthor}!`);
} else {
  response = await ApiService.recipes.clone(recipe.recipe_id);
  alert("Recipe cloned successfully!");
}
```

### Testing Coverage

- **Frontend Tests**: Comprehensive test suite with 1671 passing tests
- **RecipeActions Tests**: 5 new tests specifically for public recipe functionality
  - Button visibility for public recipes
  - Correct API method selection (clonePublic vs clone)
  - Attribution message handling
  - Error handling for public recipe operations
- **PublicRecipes Tests**: Updated to work with RecipeActions integration
- **Type Safety**: Full TypeScript compilation without errors

### Current Status

- ✅ **Implementation Complete**: All functionality implemented and tested
- ✅ **Tests Passing**: All 1671 tests passing including new public recipe tests
- ✅ **Type Safety**: TypeScript compilation successful with no errors
- ✅ **Production Ready**: Successful build with no breaking changes
- ✅ **UI Integration**: Seamless integration with existing components and workflows

## Yeast Attenuation Analytics Feature

### Implementation Status: Complete (Pending Real-World Data)

The yeast attenuation analytics feature has been fully implemented to track real-world yeast performance data and provide more accurate fermentation estimates. This feature is ready for production use but requires actual brewing data to populate meaningful analytics.

### Backend Implementation

#### Database Schema Extensions
- **Ingredient Model**: Extended with attenuation tracking fields:
  - `min_attenuation`: Float - Minimum observed attenuation percentage
  - `max_attenuation`: Float - Maximum observed attenuation percentage  
  - `avg_attenuation`: Float - Average attenuation percentage across all data points
  - `attenuation_data_points`: Integer - Number of real-world measurements collected

#### API Endpoints
- `GET /api/ingredients/attenuation-analytics` - Retrieve attenuation data for all yeasts
- `GET /api/ingredients/<id>/attenuation` - Get detailed attenuation analytics for specific yeast
- Additional ingredient endpoints return extended attenuation data

#### Services
- **AttenuationAnalyticsService**: `frontend/src/services/AttenuationAnalyticsService.ts` - TypeScript service for attenuation API calls
- **Backend ingredient routes**: Extended to handle attenuation data queries

### Frontend Implementation

#### Components
- **AttenuationAnalytics**: `frontend/src/pages/AttenuationAnalytics.tsx` - Dashboard displaying yeast performance data
- **Enhanced ingredient views**: Updated to show attenuation statistics where available
- **Recipe builder integration**: Improved FG estimates using real-world attenuation data

#### Type Definitions
- **Ingredient interfaces**: Updated TypeScript types in `frontend/src/types.ts` with optional attenuation fields
- **API response types**: Comprehensive typing for attenuation analytics endpoints

### Data Collection Strategy

The system is designed to collect attenuation data from:
1. **Brew session completions**: When users log final gravity measurements
2. **Recipe feedback**: User-reported actual vs. expected attenuation rates
3. **Community contributions**: Aggregated data from public recipes and brew sessions

### Testing Coverage

- **Frontend**: Comprehensive test suite covering all attenuation-related components and services
- **Backend**: Full API endpoint testing with mock data scenarios
- **Integration**: End-to-end testing of the analytics workflow

### Current Limitations

- **No historical data**: Feature is ready but lacks real brewing data for meaningful analytics
- **Bootstrap requirements**: Initial data collection period needed to generate useful insights
- **User adoption**: Effectiveness depends on community engagement with logging actual results

### Future Enhancements

- **Batch analysis**: Compare attenuation across different batch sizes and conditions
- **Environmental factors**: Track temperature, pH, and other variables affecting attenuation
- **Predictive modeling**: Machine learning models for attenuation prediction based on recipe composition

## AI Recipe Suggestions System

### Implementation Status: Production Ready ✅

BrewTracker now includes a comprehensive AI suggestions system that analyzes recipes and provides actionable recommendations for improvement. This system helps brewers create better, more balanced recipes that meet style guidelines using advanced brewing science and BJCP style analysis.

### Current Implementation

#### Core Features (✅ COMPLETED)
- **Enhanced Base Malt Intelligence**: Proportional increase across all base malts with intelligent style-aware selection
- **Smart Base Malt Selection**: BeerStyleGuide integration with intelligent malt recommendations based on style characteristics
- **Comprehensive Style Compliance**: Full BJCP integration with multi-metric optimization and priority-based suggestions
- **Blackprinz Malt Addition**: Automatic addition of color-adjusting grains when SRM is too low and no roasted grains exist
- **Hop Timing Optimization**: IBU-focused hop timing suggestions with conservative approach
- **Unified Suggestion System**: Single comprehensive suggestion combining all optimizations with intelligent conflict resolution
- **Stringent Quality Control**: Only shows "recipe looks good" when ALL style ranges are in spec AND base malt ≥55%

#### Technical Architecture

##### Services
- **EnhancedStyleComplianceService**: `frontend/src/services/EnhancedStyleComplianceService.ts`
  - Full BJCP style analysis with characteristic detection
  - Multi-metric optimization logic (OG, FG, ABV, IBU, SRM)
  - Style-aware prioritization and target optimization
  - Generates optimization targets with impact types (critical, important, nice-to-have)

- **SmartBaseMaltService**: `frontend/src/services/SmartBaseMaltService.ts`
  - Intelligent base malt analysis and selection
  - Style-aware grain bill recommendations
  - Fermentability scoring and color contribution analysis

- **CascadingEffectsService**: `frontend/src/services/CascadingEffectsService.ts`
  - Predicts metric changes from ingredient adjustments
  - Handles both existing ingredient modifications and new ingredient additions
  - Accurate SRM, OG, FG, ABV, IBU calculations

##### Components
- **AISuggestions**: `frontend/src/components/RecipeBuilder/AISuggestions.tsx`
  - Main suggestion UI with comprehensive optimization display
  - Unified suggestion system with detailed breakdown
  - Support for new ingredient additions (Blackprinz Malt)
  - Stringent "no suggestions" criteria with proper user feedback

##### Key Features

###### Style Characteristic Detection
- **Hop-forward identification**: IBU thresholds and description analysis
- **Malt-forward detection**: Flavor profile extraction from style text
- **Color requirements**: Dark/light style analysis from SRM ranges
- **Complexity assessment**: Simple/moderate/complex brewing requirements

###### Intelligent Malt Recommendations
- **American IPA**: 2-Row for clean hop character
- **American Stout**: Maris Otter for complementary biscuit notes
- **German Lager**: Pilsner malt for authentic crisp profile
- **Porter**: Munich malt for rich, malty character

###### New Ingredient Addition System
- **Blackprinz Malt Addition**: Automatically suggests adding 450L color malt when:
  - SRM is below style minimum
  - No existing roasted grains are available to modify
  - Calculates appropriate amounts (25g/0.5oz increments)
  - Provides accurate SRM increase predictions

###### Comprehensive Quality Control
- **Stringent Compliance Checking**: `checkRecipeFullyCompliant()` function validates:
  - Base malt percentage ≥55%
  - ALL style metrics within BJCP ranges
  - Ingredient amounts properly normalized
- **Smart User Feedback**: 
  - ✅ "Recipe Analysis Complete" only when truly compliant
  - 🔍 "Analysis Complete - Manual Review Needed" when improvements needed but can't be auto-generated

#### Current Suggestion Types
1. **Smart Base Malt Selection** - Style-aware base malt recommendations with intelligent prioritization
2. **Comprehensive Style Compliance** - BJCP-based multi-metric optimization
3. **Blackprinz Malt Addition** - Automatic color adjustment via ingredient addition
4. **Hop Timing Optimization** - IBU-focused timing adjustments (conservative approach)
5. **Normalize Amounts** - Round ingredients to brewing-friendly increments
6. **Yeast Selection** - Attenuation improvements from real-world data

#### Technical Implementation Details

##### Data Flow
1. **Style Analysis**: Load and analyze full BeerStyleGuide objects
2. **Recipe Analysis**: Analyze current recipe metrics and ingredient composition
3. **Issue Identification**: Detect areas for improvement based on brewing science and style guidelines
4. **Solution Generation**: Create actionable ingredient changes with predicted effects
5. **Unified Suggestion**: Combine all optimizations with intelligent conflict resolution
6. **Impact Calculation**: Predict metric changes using CascadingEffectsService
7. **Quality Control**: Apply stringent compliance checking before showing positive feedback

##### Key Algorithms
- **Conflict Resolution**: Priority-based merging of ingredient changes
- **SRM Calculation**: Accurate color prediction for Blackprinz additions
- **Style Compliance**: Multi-metric optimization with weighted priorities
- **Intelligent Merging**: Combines up to 6 different optimization types into single suggestion

##### Error Handling & Validation
- **Ingredient Validation**: Prevents invalid amounts (Infinity, negative, zero)
- **Type Safety**: Comprehensive TypeScript interfaces for all suggestion types
- **Graceful Fallbacks**: Handles missing style data and edge cases
- **User Feedback**: Clear error messages and guidance for manual improvements

### Integration Points
- **Recipe Builder**: Seamlessly integrated into recipe building workflow
- **BeerStyleGuide System**: Deep integration with BJCP style data
- **Style Analysis**: Works with existing style compliance system
- **Metrics Calculation**: Leverages existing brewing calculation engine
- **Ingredient Management**: Supports both modifications and new ingredient additions
- **Unit System**: Respects user metric/imperial preferences

### Testing & Quality Assurance
- **Comprehensive Test Coverage**: All services have extensive test suites
- **TypeScript Compilation**: Strict type checking for all components
- **Error Handling**: Validated edge cases and graceful degradation
- **User Experience**: Tested with real brewing scenarios

### Performance Characteristics
- **Fast Analysis**: Typically completes in <1 second
- **Accurate Predictions**: Cascading effects calculations validated against brewing science
- **Scalable Architecture**: Modular design supports future enhancements
- **Memory Efficient**: Debounced calculations prevent excessive API calls

### Future Roadmap

#### Phase 4: Advanced Color Management (🔄 PLANNED)
- **Grain Interaction Modeling**: Complex color contribution calculations
- **Smart Specialty Grain Swaps**: Maintain flavor while adjusting color
- **Maillard Reaction Factors**: Account for brewing process effects on color

#### Phase 5: Enhanced Hop System (🔄 PLANNED)
- **IBU Targeting**: Precise hop adjustments to hit style IBU ranges
- **Utilization Optimization**: Factor in OG effects on hop utilization
- **Flavor Balance**: Consider bitterness-to-sweetness ratios

#### Phase 6: Advanced Features (🔄 PLANNED)
- **Fermentation Temperature Optimization**: Yeast strain-specific recommendations
- **Water Chemistry Integration**: pH and mineral content suggestions
- **Seasonal Ingredient Availability**: Suggest alternatives based on availability

## Recent UI/UX Improvements

### Unified Recipe Display System

#### CompactRecipeCard Component
- **Location**: `frontend/src/components/CompactRecipeCard.tsx`
- **Features**: 
  - SRM color swatches with accurate beer color representation
  - Compact metrics grid (OG, ABV, IBU, SRM)
  - Consistent action buttons (View, Edit, Brew)
  - Responsive design with mobile optimization
  - Comprehensive test coverage (26 test cases)
  - Action filtering support via `showActionsInCard` prop

#### Enhanced Recipe Browsing
- **AllRecipes Page**: `frontend/src/pages/AllRecipes.tsx`
  - Advanced fuzzy search using Fuse.js
  - 14 sorting criteria (name, dates, ABV, IBU, SRM, OG - both ascending/descending)
  - Client-side filtering for instant results
  - Search results count and clear functionality

- **PublicRecipes Page**: `frontend/src/pages/PublicRecipes.tsx`
  - Unified design matching AllRecipes interface
  - Combined search/sort/filter controls
  - Preserved pagination for performance
  - Clone functionality with author attribution
  - Integrated RecipeActions component for consistent UI

#### Code Cleanup Completed
- **Removed deprecated RecipeCard component**: Old component fully replaced by CompactRecipeCard
- **Deleted associated files**:
  - `src/components/RecipeCard.tsx`
  - `src/styles/RecipeCard.css` 
  - `tests/components/RecipeCard.test.tsx`
- **Updated all imports and references**: Codebase now uses consistent component architecture
- **Maintained test coverage**: All 1,671 tests passing after cleanup

## CI/CD and Quality Assurance

### Frontend CI Pipeline (`.github/workflows/frontend-ci.yml`)

- **Node.js 22** with npm caching
- **TypeScript Compilation**: `npx tsc --noEmit` for type checking
- **Testing**: Jest with React Testing Library (1,671 tests)
- **Coverage**: 70% threshold with TypeScript file inclusion
- **Build Verification**: Production build testing
- **Codecov Integration**: Automated coverage reporting

### Backend CI Pipeline (`.github/workflows/backend-ci.yml`)

- **Python 3.13** with pip caching and MongoDB 7.0 service
- **Code Quality Checks**:
  - **Black**: Code formatting verification
  - **isort**: Import sorting with Black-compatible configuration (`.isort.cfg`)
  - **flake8**: Critical linting (syntax errors, undefined names)
- **Testing**: pytest with mongomock (271 tests)
- **Coverage**: 70% threshold with comprehensive reporting
- **Codecov Integration**: Automated coverage reporting

### Quality Tooling

- **TypeScript**: Strict configuration with comprehensive type checking
- **Jest**: Modern testing framework with React Testing Library
- **Black + isort**: Automated Python code formatting and import organization
- **ESLint**: JavaScript/TypeScript linting (React app configuration)
- **Git Hooks**: Pre-commit quality checks (when configured)

### Branch Strategy

- **Main Branch**: Production-ready code
- **Develop Branch**: Integration branch for features
- **CI Triggers**: Push and PR events for both main and develop branches
- **Path-based Triggers**: Frontend/backend CI only runs when relevant files change

## Development Best Practices

### Code Quality Standards

- **TypeScript**: Use strict type checking for all new frontend code
- **Testing**: Maintain test coverage above 70% threshold
- **Formatting**: Backend code must pass Black, isort, and flake8 checks
- **Type Safety**: All new services should have comprehensive TypeScript interfaces

### Git Workflow

- **Branch Protection**: All code must pass CI checks before merging
- **Quality Gates**: TypeScript compilation, test coverage, and linting must pass
- **Semantic Commits**: Use descriptive commit messages
- **PR Requirements**: All changes require passing frontend and backend CI

### New Feature Development

1. **Frontend**: Create TypeScript files (.ts/.tsx) for new components/services
2. **Backend**: Follow Black/isort formatting standards
3. **Testing**: Add comprehensive tests for new functionality
4. **Types**: Define proper TypeScript interfaces before implementation
5. **Documentation**: Update CLAUDE.md for significant architectural changes

# Important Instruction Reminders

## Core Principles

- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User

## Test Failure Resolution Protocol

When tests are failing, systematically analyze each failure and apply this decision framework:

### 1. Determine Root Cause

- **Mock Data Issues**: Check if test mocks match actual API response structure
- **Type Mismatches**: Verify data types align between component and test expectations
- **Component Behavior**: Assess if component logic matches test assumptions

### 2. Apply Fix Strategy

- **Update Tests When**: Component behavior is correct but tests have outdated expectations
- **Fix Implementation When**: Tests represent better design patterns or API standards
- **Examples of Implementation Fixes**:
  - Filtering out empty form fields instead of sending `undefined` values
  - Using `null` vs `undefined` for consistent API communication
  - Proper data transformation and validation

### 3. Ensure Consistency

- Apply similar patterns across related components for uniformity
- Maintain backward compatibility when possible
- Document significant behavior changes in commit messages
