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
- **Key Feature**: Brewing calculation engine with metric/imperial unit conversion

### Core Business Logic

#### Calculation System

- **Core calculations**: `backend/utils/brewing_calculation_core.py` - Core brewing formulas (OG, FG, ABV, IBU, SRM)
- **ORM calculator**: `backend/utils/recipe_orm_calculator.py` - Calculations for database models
- **API calculator**: `backend/utils/recipe_api_calculator.py` - Calculations for API preview requests
- **Unit conversions**: `backend/utils/unit_conversions.py` - Metric/imperial conversions

#### Data Models

- **MongoDB models**: `backend/models/mongo_models.py` - User, Recipe, Ingredient, BrewSession, BeerStyleGuide
- **Database service**: `backend/services/mongodb_service.py` - MongoDB interaction layer

#### Frontend Architecture

- **Unit context**: `frontend/src/contexts/UnitContext.ts` - Global metric/imperial preference management (TypeScript)
- **Service layer**: `frontend/src/services/` - Fully TypeScript API abstractions for different domains
- **Custom hooks**: `frontend/src/hooks/useRecipeBuilder.ts` - Complex recipe state management (TypeScript)
- **Fuzzy search**: `frontend/src/components/SearchableSelect.tsx` - Fuse.js-powered ingredient search (TypeScript)

### Key Features

- **Recipe Builder**: Complex multi-ingredient recipe creation with real-time calculations
- **Brew Sessions**: Track fermentation progress and brewing notes
- **BeerXML**: Import/export recipes in standard format
- **Beer Style Analysis**: Compare recipes against BJCP style guidelines
- **Public/Private Recipes**: Recipe sharing system
- **Version Control**: Recipe cloning with parent-child relationships

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

## TypeScript Migration Progress

### Overview

The frontend is being gradually migrated from JavaScript to TypeScript for better type safety and developer experience. Migration strategy uses backward-compatible wrappers to ensure no breaking changes during the transition.

### Completed Phases

#### ✅ Phase 1: Foundation Setup (COMPLETED)

- **TypeScript Configuration**: `frontend/tsconfig.json` with strict settings and path mapping
- **Comprehensive Type Definitions**: 8 type definition files covering the entire domain
  - `frontend/src/types/recipe.ts` - Recipe and ingredient interfaces (15+ types)
  - `frontend/src/types/api.ts` - Complete API request/response types
  - `frontend/src/types/beer-styles.ts` - Beer style guide and analysis types
  - `frontend/src/types/units.ts` - Unit system and conversion types
  - `frontend/src/types/user.ts` - User account and authentication types
  - `frontend/src/types/brew-session.ts` - Fermentation tracking types
  - `frontend/src/types/metrics.ts` - Recipe calculation types
  - `frontend/src/types/common.ts` - Base interfaces and utilities

#### ✅ Phase 2A: API Service Migration (COMPLETED)

- **File**: `frontend/src/services/api.js` → `frontend/src/services/api.ts`
- **Result**: Fully typed API service with type-safe request/response handling
- **Features**: Axios integration with TypeScript, JWT token management, error handling

#### ✅ Phase 2B: Utility Functions Migration (COMPLETED)

- **File**: `frontend/src/utils/formatUtils.js` → `frontend/src/utils/formatUtils-ts.ts`
- **Result**: Type-safe formatting and unit conversion utilities
- **Features**: Proper null/undefined handling, backward compatibility wrapper

#### ✅ Phase 2C: Context Migration (COMPLETED)

- **File**: `frontend/src/contexts/UnitContext.js` → `frontend/src/contexts/UnitContext.ts`
- **Result**: Fully typed unit conversion context with comprehensive interfaces
- **Features**: Type-safe unit conversions, measurement types, batch scaling

#### ✅ Phase 2D: Core Hooks Migration (COMPLETED)

- **File**: `frontend/src/hooks/useRecipeBuilder.js` → `frontend/src/hooks/useRecipeBuilder.ts`
- **Result**: Complex recipe state management hook with full type safety
- **Features**: Async operations, ingredient management, metric calculations, beer style analysis

#### ✅ Phase 2E: Utility Components Migration (COMPLETED)

- **File**: `frontend/src/components/SearchableSelect.js` → `frontend/src/components/SearchableSelect.ts`
- **Result**: Type-safe fuzzy search component with Fuse.js integration
- **Features**: Generic component, keyboard navigation, search highlighting, accessibility

#### ✅ Phase 2F: Complex Pages Migration (COMPLETED)

- **File**: `frontend/src/pages/RecipeBuilder.js` → `frontend/src/pages/RecipeBuilder.tsx`
- **Result**: Main recipe building page with full type safety and hook integration
- **Features**: BeerXML import/export, complex UI orchestration, service integration

#### ✅ Phase 2G: Complete Service Layer Migration (COMPLETED)

- **All Services Migrated**: Complete TypeScript migration of entire service layer
- **Core Services**: IngredientService, RecipeService, MetricService, BrewSessionService, BeerStyleService
- **BeerXML Services**: BeerXMLService, IngredientMatchingService
- **Utility Services**: CacheManager, RecipeDefaultsService, UserSettingsService
- **Service Index**: Centralized service exports with health checking
- **Features**: Full type safety, backward compatibility, enhanced business logic, singleton patterns

### Critical Issues Resolved

1. **Authentication Fix**: Changed API URL from `localhost:5000` to `127.0.0.1:5000` to avoid Apple AirTunes port conflicts
2. **TypeScript Compatibility**: Downgraded TypeScript to 4.9.5 for React Scripts 5.0.1 compatibility
3. **Circular Import Fix**: Corrected API service wrapper import path from `'./api'` to `'./api.ts'`

### Current Status

- ✅ **Working**: React app compiles and runs successfully
- ✅ **Authentication**: Login/logout functionality working properly
- ✅ **Type Safety**: All migrated components have full TypeScript coverage
- ✅ **Backward Compatibility**: JavaScript components continue working with TypeScript services

### Next Phases (READY TO START)

- **Phase 3A**: Component Migration Phase
  - 🔄 High-priority components: RecipeCard, Dashboard, BrewSessions
  - 🔄 Form components: RecipeForm, IngredientForm, UserSettingsForm
  - 🔄 Layout components: Navigation, Header, Footer
- **Phase 3B**: Page Migration Phase
  - 🔄 User pages: Dashboard, Profile, Settings
  - 🔄 Recipe pages: RecipeList, RecipeDetail, PublicRecipes
  - 🔄 Session pages: BrewSessions, SessionDetail
- **Phase 4**: Polish and optimization phase
  - Remove remaining JavaScript wrappers
  - Optimize type definitions
  - Add stricter typing where beneficial
  - Performance optimizations

### Environment Setup for TypeScript Migration

When resuming TypeScript migration work:

1. **Start React app**: `cd frontend && REACT_APP_API_URL=http://127.0.0.1:5000/api npm start`
   - **Important**: Use `127.0.0.1` instead of `localhost` to avoid AirTunes conflicts
2. **Start backend**: `cd backend && flask run`

### Migration Pattern

Each file follows this pattern:

1. Create TypeScript version with `.ts` extension
2. Add comprehensive type definitions using existing types
3. Update JavaScript file to re-export from TypeScript version
4. Test compilation and runtime functionality
5. Ensure backward compatibility maintained

### Key Technical Decisions

- **TypeScript Version**: 4.9.5 (React Scripts compatibility)
- **Migration Strategy**: Gradual with backward compatibility wrappers
- **Type Coverage**: Comprehensive interfaces for all business logic
- **Path Mapping**: Clean imports using `@/components`, `@/types`, etc.
- **API Integration**: Fully typed axios service layer
