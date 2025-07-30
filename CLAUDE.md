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
- **Run tests (parallel)**: `cd backend && pytest -n auto`
- **Run tests with coverage**: `cd backend && pytest --cov`
- **Run tests with coverage (parallel)**: `cd backend && pytest --cov -n auto`
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
- **AI/**: AIService (frontend interface to backend flowchart system)
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

## AI Recipe Analysis System - Flowchart Architecture ✅

### Implementation Status: Production Ready

BrewTracker now uses a **flowchart-based AI system** that replaced the previous monolithic approach. This system provides sequential, deterministic recipe optimization following brewing science principles and BJCP style guidelines.

### Architecture Overview

#### Core Components

- **FlowchartAIService**: `backend/services/ai/flowchart_ai_service.py` - Main AI service orchestrator
- **FlowchartEngine**: `backend/services/ai/flowchart_engine.py` - Workflow execution engine
- **FlowchartNodes**: `backend/services/ai/flowchart_nodes.py` - Node type implementations
- **OptimizationStrategies**: `backend/services/ai/optimization_strategies.py` - Recipe modification strategies
- **RecipeContext**: `backend/services/ai/recipe_context.py` - Recipe data management and calculations
- **WorkflowConfigLoader**: `backend/services/ai/workflow_config_loader.py` - YAML workflow loading

#### Workflow Definition

- **Configuration**: `backend/services/ai/workflows/recipe_optimization.yaml` - Complete 9-step sequential optimization process
- **Visual Reference**: `backend/services/ai/workflows/AI_flowchart.png` - Flowchart diagram

### Key Features

#### Sequential Gating System

The system follows a 9-step sequential process:

1. **Initial Metrics Check**: Verify if all metrics are already in range
2. **OG Correction**: Original Gravity adjustments via base malt modifications
3. **SRM Correction**: Color adjustments via specialty grain swaps and additions
4. **FG Correction**: Final Gravity adjustments via yeast substitution
5. **ABV Correction**: Alcohol content fine-tuning via targeted OG adjustments
6. **IBU Correction**: Bitterness adjustments via hop timing and amount changes
7. **Final Validation**: Ensure all metrics remain in range after corrections
8. **Normalization**: Round amounts to brewing-friendly increments
9. **Completion**: Recipe optimization finished

#### Intelligence Features

- **Style-Aware Corrections**: Different strategies based on BJCP style characteristics
- **Brewing-Realistic Changes**: All adjustments use standard brewing increments (25g/0.5oz)
- **Cascade Prevention**: Sequential gating prevents metric interactions from causing loops
- **Conservative Targeting**: Aims for 25% within style ranges to avoid edge cases

#### Advanced Strategies

- **Base Malt Management**: Proportional increases/decreases maintaining existing ratios
- **Specialty Grain Swaps**: Caramel malt substitutions for SRM adjustments
- **Yeast Intelligence**: Attenuation-based strain recommendations from comprehensive database
- **Hop Optimization**: Time-before-amount strategy for IBU adjustments

### Technical Implementation

#### Data Flow

1. **Frontend Request**: Recipe data sent to `ai_routes.py`
2. **Service Initialization**: FlowchartAIService loads workflow configuration
3. **Context Creation**: RecipeContext wraps recipe data with calculation methods
4. **Engine Execution**: FlowchartEngine executes workflow nodes sequentially
5. **Strategy Application**: OptimizationStrategies modify recipe based on node results
6. **Response**: Optimized recipe returned with change summary

#### Node Types

- **Start/End Nodes**: Workflow entry and exit points
- **Decision Nodes**: Metric evaluation and path routing
- **Multi-Decision Nodes**: Complex branching based on multiple conditions
- **Action Nodes**: Recipe modification operations

#### Strategy Categories

- **base_malt_reduction**: Reduce base malts for high OG
- **base_malt_og_and_srm**: Increase dark base malts for low OG+SRM
- **base_malt_og_only**: Increase light base malts for low OG only
- **caramel_malt_swap**: Swap caramel malts for SRM adjustment
- **roasted_malt_increase/decrease**: Modify roasted grains for SRM
- **yeast_substitution**: Change yeast strains for FG adjustment
- **abv_targeted**: Precise ABV targeting via OG modification
- **hop_ibu_adjustment**: Hop timing and amount optimization
- **normalize_amounts**: Round to brewing-friendly increments

### Integration Points

- **Recipe Builder**: Seamlessly integrated into recipe building workflow
- **BeerStyleGuide System**: Deep integration with BJCP style data
- **Style Analysis**: Works with existing style compliance system
- **Metrics Calculation**: Leverages existing brewing calculation engine
- **Unit System**: Respects user metric/imperial preferences

### Performance Characteristics

- **Deterministic**: Same input always produces same output
- **Fast Execution**: Typically completes in <1 second
- **Memory Efficient**: Stateless execution with minimal memory footprint
- **Scalable**: Modular design supports easy workflow modifications

### Testing Coverage

- **FlowchartEngine Tests**: `backend/tests/test_flowchart_engine.py` - Core engine functionality
- **Strategy Tests**: Individual optimization strategy validation
- **Integration Tests**: End-to-end workflow execution
- **Edge Case Handling**: Malformed recipes and extreme values

### Legacy System Migration

The old monolithic `ai_service.py` system has been completely replaced with this flowchart-based architecture. Key improvements include:

- **Deterministic Behavior**: Eliminates previous issues with iterative loops and string substitution errors
- **Modular Design**: Each strategy is isolated and testable
- **Clear Logic Flow**: YAML configuration makes optimization logic transparent
- **Better Maintainability**: New optimization strategies can be added without touching core engine code

## Recent UI/UX Improvements

### Unified Recipe Display System

#### CompactRecipeCard Component
- **Location**: `frontend/src/components/CompactRecipeCard.tsx`
- **Features**: 
  - SRM color swatches with accurate beer color representation
  - Enhanced metrics grid (OG, FG, ABV, IBU, SRM) with improved display order
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

### Metrics Display Improvements

- **Fixed Order Display**: All recipe metrics now display in consistent order (OG, FG, ABV, IBU, SRM)
- **Enhanced FG Display**: Final Gravity now included in compact card metrics alongside SRM color swatch
- **Color Integration**: SRM values positioned next to visual color swatches for better user experience
- **Improved Consistency**: Unified metrics display across all recipe viewing contexts

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

### Service Integration with Flowchart AI System

When working with the AI system:

1. **Use FlowchartAIService**: All AI requests should go through the main service
2. **Understand Workflow**: Review `recipe_optimization.yaml` for optimization logic
3. **Strategy Extension**: Add new strategies to `OptimizationStrategies` class
4. **Node Types**: Understand decision/action/multi-decision node types
5. **Testing**: Add workflow tests for new optimization paths

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

### AI System Development Notes

- **Workflow Modifications**: Changes to optimization logic should be made in YAML configuration
- **Strategy Implementation**: New optimization strategies go in `OptimizationStrategies` class
- **Engine Extensions**: Core engine modifications require careful testing of all workflow paths
- **Context Management**: Recipe data transformations should be handled in `RecipeContext`
- **Testing Requirements**: All AI system changes require comprehensive test coverage

### Legacy System Notes

The old monolithic `ai_service.py` system has been completely replaced with the flowchart-based architecture. Any references to the old system in documentation or comments should be updated to reflect the new architecture.
