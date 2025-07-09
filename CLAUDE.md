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

### Key Features

- **Recipe Builder**: Complex multi-ingredient recipe creation with real-time calculations
- **Brew Sessions**: Track fermentation progress and brewing notes
- **BeerXML**: Import/export recipes in standard format
- **Beer Style Analysis**: Compare recipes against BJCP style guidelines
- **Public/Private Recipes**: Recipe sharing system with unified compact card design
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

### Implementation Status: Phase 2 Complete

BrewTracker now includes an intelligent AI suggestions system that analyzes recipes and provides actionable recommendations for improvement. This system helps brewers create better, more balanced recipes that meet style guidelines using advanced brewing science and BJCP style analysis.

### Current Implementation

#### Phase 1: Base Malt Intelligence (✅ COMPLETED)
- **Enhanced Base Malt Suggestions**: Proportional increase across all base malts instead of targeting just the largest
- **Bulk Update System**: Atomic ingredient updates preventing race conditions
- **Cascading Effects Calculator**: Real-time prediction of OG/FG/ABV/IBU/SRM changes from ingredient adjustments
- **Visual Impact Preview**: Shows exact metric changes before applying suggestions

#### Phase 2: Smart Base Malt Selection (✅ COMPLETED)
- **BeerStyleGuide Integration**: Uses full BJCP style objects instead of keyword matching
- **Intelligent Style Analysis**: Extracts brewing characteristics from style descriptions and ranges
- **Style-Aware Malt Selection**: Recommends specific base malts based on style requirements
- **Advanced Grain Bill Analysis**: Considers fermentability, color contribution, and flavor profiles

#### Components
- **AISuggestions**: `frontend/src/components/RecipeBuilder/AISuggestions.tsx` - Main suggestion UI with BeerStyleGuide integration
- **CascadingEffectsService**: `frontend/src/services/CascadingEffectsService.ts` - Calculates metric change predictions
- **SmartBaseMaltService**: `frontend/src/services/SmartBaseMaltService.ts` - Intelligent base malt analysis and selection
- **Bulk Update Hook**: Enhanced `useRecipeBuilder` with `bulkUpdateIngredients()` method

#### Current Suggestion Types
1. **Normalize Amounts** - Round ingredients to brewing-friendly increments
2. **Smart Base Malt Selection** - Style-aware base malt recommendations with intelligent prioritization
3. **Hop Timing Optimization** - Improve aroma retention and bitterness balance
4. **Style Compliance (Enhanced)** - BJCP-based compliance checking using full style data
5. **Yeast Selection** - Attenuation improvements from real-world data

#### Smart Base Malt Features
- **Style Characteristic Detection**: 
  - Dark/light style analysis from SRM ranges
  - Hop-forward identification from IBU thresholds and descriptions
  - Complex malt requirement detection from flavor descriptions
  - Primary flavor extraction from style text analysis
- **Malt Recommendations by Style**:
  - **American IPA**: 2-Row for clean hop character
  - **American Stout**: Maris Otter for complementary biscuit notes
  - **German Lager**: Pilsner malt for authentic crisp profile
  - **Porter**: Munich malt for rich, malty character
- **Grain Bill Analysis**: Fermentability scoring, color contribution, specialty grain balance

### Planned Implementation Roadmap

#### Phase 3: Enhanced Style Guidelines Integration (🔄 NEXT)
- **Comprehensive BJCP compliance**: Deep integration with all style specifications
- **Priority-based suggestions**: Different styles prioritize different characteristics
- **Multi-metric optimization**: Suggest changes that improve multiple compliance metrics
- **Style-specific suggestion ordering**: Present recommendations in brewing-logical sequence

#### Phase 4: Color Management System
- **SRM prediction accuracy**: Consider grain interactions and Maillard reactions
- **Smart specialty grain swaps**: Maintain flavor while adjusting color
- **Color-style compliance**: Ensure color stays within style after base malt changes
- **Grain interaction modeling**: Account for complex color contributions

#### Phase 5: Hop Optimization Engine
- **IBU targeting**: Precise hop adjustments to hit style IBU ranges
- **Utilization calculations**: Factor in OG effects on hop utilization
- **Hop scheduling intelligence**: Optimize boil times and whirlpool additions
- **Flavor balance**: Consider bitterness-to-sweetness ratios

#### Phase 6: Yeast Selection Assistant
- **Attenuation matching**: Suggest yeasts to achieve target FG/ABV
- **Style-appropriate strains**: Recommend yeasts that complement beer style
- **Fermentation temperature optimization**: Suggest fermentation schedules

#### Phase 7: Advanced Features
- **Staged suggestion workflow**: Present suggestions in logical brewing order
- **Impact prediction**: Show cascading effects for all suggestion types
- **Alternative solutions**: Multiple approaches for each identified issue
- **Constraint-based optimization**: Respect user preferences and ingredient availability

### Technical Architecture

#### Key Design Principles
1. **BJCP-driven intelligence**: All suggestions based on official style guidelines and brewing science
2. **Modular suggestion engine**: Each suggestion type is independently developed and testable
3. **Cascading effects awareness**: All suggestions consider impacts on other recipe metrics
4. **Style-driven intelligence**: BeerStyleGuide objects inform all recommendation logic
5. **Atomic updates**: Bulk ingredient changes prevent race conditions and state inconsistencies
6. **User experience focused**: Clear impact previews and logical suggestion ordering

#### Data Flow
1. **Style Analysis**: Load and analyze full BeerStyleGuide objects for intelligent recommendations
2. **Recipe Analysis**: Analyze current recipe metrics and ingredient composition
3. **Issue Identification**: Detect areas for improvement based on brewing best practices and style guidelines
4. **Solution Generation**: Create actionable ingredient changes with predicted effects
5. **Impact Calculation**: Use CascadingEffectsService to predict metric changes
6. **User Presentation**: Display suggestions with clear before/after comparisons and style context
7. **Bulk Application**: Apply all changes atomically via enhanced useRecipeBuilder hook

#### Smart Base Malt Service Architecture
- **Style Characteristic Analysis**: Extracts brewing requirements from BeerStyleGuide objects
- **Malt Recommendation Engine**: Generates style-specific base malt suggestions
- **Grain Bill Intelligence**: Analyzes fermentability, color, and flavor contributions
- **Fallback Mechanisms**: Handles cases where style data is unavailable

### Integration Points
- **Recipe Builder**: Seamlessly integrated into the recipe building workflow
- **BeerStyleGuide System**: Deep integration with BJCP style data
- **Style Analysis**: Works with existing style compliance system
- **Metrics Calculation**: Leverages existing brewing calculation engine
- **Ingredient Management**: Respects ingredient availability and validation rules

### Testing Coverage
- **SmartBaseMaltService**: Comprehensive test suite covering grain bill analysis and recommendations
- **Component Integration**: Tests for BeerStyleGuide integration in AI suggestions
- **Cascading Effects**: Validated metric change predictions
- **Error Handling**: Graceful fallbacks when style data unavailable

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

#### Code Cleanup Completed
- **Removed deprecated RecipeCard component**: Old component fully replaced by CompactRecipeCard
- **Deleted associated files**:
  - `src/components/RecipeCard.tsx`
  - `src/styles/RecipeCard.css` 
  - `tests/components/RecipeCard.test.tsx`
- **Updated all imports and references**: Codebase now uses consistent component architecture
- **Maintained test coverage**: All 1,577 tests passing after cleanup

## CI/CD and Quality Assurance

### Frontend CI Pipeline (`.github/workflows/frontend-ci.yml`)

- **Node.js 22** with npm caching
- **TypeScript Compilation**: `npx tsc --noEmit` for type checking
- **Testing**: Jest with React Testing Library (1,577 tests)
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
