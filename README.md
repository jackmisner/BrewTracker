# 🍺 BrewTracker

A comprehensive brewing management application that helps homebrewers create, manage, and track their beer recipes and brewing sessions.

## 🌟 About the Application

BrewTracker is a full-stack web application that enables homebrewers to:

- Create and manage beer recipes with detailed ingredients and metrics
- Calculate important brewing metrics (OG, FG, ABV, IBU, SRM)
- Track brewing sessions and fermentation progress
- Analyze yeast performance with real-world attenuation data
- Browse and share recipes with advanced search and filtering
- Get AI-powered recipe suggestions for style compliance and optimization
- Share recipes publicly with proper attribution and access control
- View recipe statistics and brewing history

## 🏗️ Project Structure

This repository contains two applications:

- 🖥️ A frontend React App - User interface for recipe management
- 🔌 A backend Flask API - Python-based server handling recipe calculations and data storage

```
homebrew-tracker/
├── backend/
│   ├── app.py                                            # Flask application factory with auto-seeding, CORS, and blueprint registration
│   ├── config.py                                         # Environment-specific configuration classes (development, testing, production)
│   ├── data/                                             # Static JSON data files for ingredients and beer style guides
│   ├── models/                                           # Database models
│   │   ├── __init__.py
│   │   └── mongo_models.py                               # MongoEngine ODM models with validation, relationships, and business logic
│   ├── routes/                                           # Flask blueprints for API endpoints
│   │   ├── __init__.py
│   │   ├── ai_routes.py                                  # Automated recipe analysis and suggestion generation endpoints
│   │   ├── attenuation_analytics.py                      # Real world yeast attenuation analysis and statistics endpoints
│   │   ├── auth.py                                       # User authentication and authorization endpoints
│   │   ├── beer_styles.py                                # Beer style guide and analysis endpoints
│   │   ├── beerxml.py                                    # BeerXML import/export functionality endpoints
│   │   ├── brew_sessions.py                              # Brew session tracking and fermentation management endpoints
│   │   ├── ingredients.py                                # Ingredient CRUD operations, search endpoints, and yeast attenuation analytics
│   │   ├── recipes.py                                    # Recipe CRUD operations and calculation endpoints
│   │   └── user_settings.py                              # User preferences and account management endpoints
│   ├── seeds/                                            # Database seeding scripts
│   │   ├── seed_ingredients.py                           # Seeds ingredients from JSON data
│   │   └── seed_beer_styles.py                           # Seeds beer style guides from JSON data
│   ├── services/                                         # Business logic layer
│   │   ├── __init__.py
│   │   ├── ai_service.py                                 # Service for automated recipe analysis and optimization suggestions based on brewing science and BJCP style guidelines.
│   │   ├── attenuation_service.py                        # Service for collecting and analyzing real-world yeast attenuation data
│   │   └── mongodb_service.py                            # Database abstraction layer with connection management and query utilities
│   ├── tests/                                            # pytest test suite for backend functionality
│   ├── utils/                                            # Utility functions
│   │   ├── __init__.py
│   │   ├── brewing_calculation_core.py                   # Pure brewing mathematics (OG, FG, ABV, IBU, SRM calculations)
│   │   ├── recipe_orm_calculator.py                      # Recipe calculations integrated with MongoDB models and validation
│   │   ├── recipe_api_calculator.py                      # Real-time recipe calculations for API endpoints without database persistence
│   │   └── unit_conversions.py                           # Metric/imperial conversion utilities for weight, volume, and temperature
│   ├── requirements.txt                                  # Python package dependencies for backend
│   └── .env                                              # Environment variables for database URI, JWT secrets, and Flask configuration
├── frontend/
│   ├── public/
│   │   ├── index.html                                    # Main HTML template for React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── BeerXML/                                  # BeerXML import/export components with ingredient matching and validation
│   │   │   ├── BrewSessions/                             # Brew session management with fermentation tracking and progress monitoring
│   │   │   ├── Header/                                   # Application header with responsive navigation and user authentication status
│   │   │   ├── RecipeBuilder/                            # Complex recipe creation interface with real-time calculations, ingredient management, and AI suggestions
│   │   │   ├── CompactRecipeCard.tsx                     # Unified recipe display component with SRM color swatches, metrics grid, and action filtering
│   │   │   ├── RecipeActions.tsx                         # Action buttons for recipe operations with public recipe access control (edit, delete, clone, share)
│   │   │   └── SearchableSelect.ts                       # Fuzzy search component with Fuse.js for intelligent ingredient matching and suggestions
│   │   ├── contexts/
│   │   │   └── UnitContext.ts                            # React context for global metric/imperial unit preference management
│   │   ├── hooks/                                        # Custom React hooks for state management and business logic
│   │   │   ├── index.ts                                  # Central export for all custom hooks
│   │   │   └── useRecipeBuilder.ts                       # Recipe builder state management and validation logic
│   │   ├── images/                                       # Static image assets (logos, icons, placeholders)
│   │   ├── pages/
│   │   │   ├── AllRecipes.tsx                            # Personal recipe library with advanced fuzzy search, 14 sorting criteria, and unified compact design
│   │   │   ├── AttenuationAnalytics.tsx                  # Yeast attenuation analytics dashboard with real-world performance data
│   │   │   ├── Dashboard.tsx                             # User dashboard with recent activity, quick stats, and navigation shortcuts
│   │   │   ├── IngredientManager.tsx                     # Ingredient database management with creation, editing, and bulk operations
│   │   │   ├── Login.tsx                                 # User authentication login page
│   │   │   ├── PublicRecipes.tsx                         # Community recipe sharing with unified design, search, sorting, style filtering, and access control
│   │   │   ├── RecipeBuilder.tsx                         # Create and edit recipes with ingredient management
│   │   │   ├── Register.tsx                              # User registration page with account creation form
│   │   │   ├── UserSettings.tsx                          # User preferences for units, account details, and application settings
│   │   │   └── ViewRecipe.tsx                            # Detailed recipe view with calculations, brew sessions, and sharing options
│   │   ├── services/                                     # TypeScript service layer for API communication and business logic
│   │   │   ├── api.ts                                    # Low-level HTTP client with authentication and error handling
│   │   │   ├── index.ts                                  # Central export hub for all service modules
│   │   │   ├── CacheManager.ts                           # Client-side caching for improved performance
│   │   │   ├── Analytics/                                # Data analysis and insights
│   │   │   │   ├── AttenuationAnalyticsService.ts        # Yeast attenuation analytics and real-world performance data management
│   │   │   │   └── MetricService.ts                      # Recipe calculations (OG, FG, ABV, IBU, SRM) and analysis
│   │   │   ├── AI/                                       # AI recipe suggestion services
│   │   │   │    └── AiService.ts                         # Simplified AI Service for Backend API Communication
│   │   │   ├── BeerXML/                                  # BeerXML format handling services
│   │   │   │   ├── BeerXMLService.ts                     # BeerXML import/export and format conversion
│   │   │   │   └── IngredientMatchingService.ts          # Ingredient mapping and matching for BeerXML imports
│   │   │   ├── Brewing/                                  # Brewing process management
│   │   │   │   └── BrewSessionService.ts                 # Brew session tracking and fermentation data management
│   │   │   ├── Data/                                     # Core data management
│   │   │   │   ├── BeerStyleService.ts                   # Beer style matching and analysis against BJCP guidelines
│   │   │   │   ├── IngredientService.ts                  # Ingredient search, CRUD operations, and database management
│   │   │   │   └── RecipeService.ts                      # Recipe CRUD operations, cloning, sharing functionality, and public recipe access control
│   │   │   └── User/                                     # User-specific services
│   │   │       ├── RecipeDefaultsService.ts              # Default value generation based on user preferences and recipe type
│   │   │       └── UserSettingsService.ts                # User preferences, account management, and settings persistence
│   │   ├── styles/                                       # CSS for various frontend components
│   │   ├── types/                                        # Comprehensive TypeScript type definitions for BrewTracker
│   │   │   ├── api.ts                                    # API request/response interface definitions
│   │   │   ├── beer-styles.ts                            # Beer style guide and analysis type definitions
│   │   │   ├── brew-session.ts                           # Brew session and fermentation tracking types
│   │   │   ├── common.ts                                 # Shared utility types and common interfaces
│   │   │   ├── globals.d.ts                              # Global TypeScript declarations and module augmentations
│   │   │   ├── index.ts                                  # Central export for all type definitions
│   │   │   ├── metrics.ts                                # Brewing calculation and measurement types
│   │   │   ├── recipe.ts                                 # Recipe, ingredient, and calculation type definitions
│   │   │   ├── units.ts                                  # Unit system and conversion type definitions
│   │   │   └── user.ts                                   # User account and settings type definitions
│   │   ├── utils/
│   │   │   └── formatUtils.ts                            # Utility functions for unit formatting and display
│   │   ├── App.tsx                                       # Main React application component with routing and global providers
│   │   └── index.tsx                                     # React application entry point and DOM rendering
│   ├── tests/                                            # Jest + TypeScript tests for React components and utilities
│   ├── package.json                                      # Node.js dependencies, scripts, and project configuration
│   └── .env                                              # Environment variables for API URLs and frontend configuration
└── README.md                                             # The document you are currently reading!
```

## 📋 Requirements

- Node.js (v22+)
- Python (v3.13+)
- MongoDB (v7.0+)
- TypeScript (v4.9+) - automatically installed with frontend dependencies

## 🚀 Quickstart

### 📥 Install Dependencies

1. Install Node.js using NVM:

```bash
brew install nvm
nvm install 22
```

2. Install Python 3.13:

```bash
brew install python@3.13
```

3. Install MongoDB:

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
```

### 🛠️ Set up your project

1. Clone the repository:

```bash
git clone https://github.com/jackmisner/BrewTracker.git
cd BrewTracker
```

2. Install dependencies:

```bash
# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Verify TypeScript setup:

```bash
# Check TypeScript compilation (from frontend directory)
cd frontend
npx tsc --noEmit
```

4. Start MongoDB:

```bash
brew services start mongodb-community
```

### ⚙️ Environment Setup

#### Frontend

Create `frontend/.env`:

```plaintext
REACT_APP_API_URL="http://localhost:5000"
```

#### Backend

Create `backend/.env`:

```plaintext
MONGO_URI="mongodb://localhost:27017/brewtracker"
JWT_SECRET_KEY="your_secret_key_here"
FLASK_APP="app.py"
FLASK_ENV="development"
```

### 📦 Database Setup

No explicit database setup commands are needed for MongoDB.
When you first start the application:

1. MongoDB will automatically create the database and collections as needed
2. The application will check if ingredient data exists
3. If no ingredients are found, it will automatically seed the database with initial ingredient data from `backend/data/brewtracker.ingredients.json` using `backend/seeds/seed_ingredients.py`
4. Similarly, beer style guides will be seeded from `backend/data/beer_style_guides.json` using `backend/seeds/seed_beer_styles.py`

To manually verify your MongoDB setup:

```bash
# Start the MongoDB shell
mongosh

# Switch to your database
use brewtracker

# Verify collections
show collections
```

## 🏃‍♂️ Running the Application

1. Start the backend server:

```bash
cd backend
flask run
```

2. In a new terminal, start the frontend:

```bash
cd frontend
npm start
```

Visit `http://localhost:3000` to access the application.

## 🔑 Features

- 📝 Recipe Creation and Management

  - Add/edit/delete recipes with comprehensive ingredient management
  - Automatic metric calculations with real-time updates
  - Recipe cloning with version control and parent-child relationships
  - Advanced recipe browsing with fuzzy search and 14 sorting criteria
  - Unified compact recipe cards with SRM color visualization
  - AI-powered recipe suggestions for style compliance and optimization
  - Public recipe access control with attribution and unlinked cloning

- 📊 Brewing Metrics & Analytics

  - Core brewing calculations: Original Gravity (OG), Final Gravity (FG), Alcohol By Volume (ABV)
  - Hop calculations: International Bitterness Units (IBU) with multiple hop addition types
  - Colour analysis: Standard Reference Method (SRM) with accurate beer colour representation
  - Yeast Attenuation Analytics: Real-world yeast performance tracking with min/max/average attenuation rates

- 🔄 Brew Session Tracking

  - Track fermentation progress with detailed logging
  - Record brewing notes and process observations
  - Monitor temperature and fermentation conditions
  - Link brew sessions to recipes for performance analysis

- 🌐 Community Features

  - Public/private recipe visibility with sharing controls and access management
  - Community recipe library with advanced search and filtering
  - Recipe cloning from public submissions with proper attribution
  - User attribution and recipe discovery
  - Unlinked public recipe cloning for independent recipe development

- 🔧 Advanced Tools

  - BeerXML import/export for recipe portability
  - Beer style analysis against BJCP guidelines
  - Ingredient database management with search capabilities
  - Metric/Imperial unit conversion and user preferences
  - AI recipe suggestions with style compliance optimization and intelligent ingredient recommendations

- 👥 User Experience
  - Secure JWT-based authentication
  - Responsive design optimized for desktop and mobile
  - Real-time recipe calculations and validation
  - Comprehensive search with Fuse.js fuzzy matching

## 💻 Tech Stack

- Frontend:

  - React 19 with TypeScript
  - React Router
  - Axios
  - Fuse.js for fuzzy searching
  - TypeScript for type safety
  - Jest for testing

- Backend:
  - Flask
  - MongoEngine & PyMongo
  - JWT Authentication
  - MongoDB

## 🧪 Development & Testing

### Test Coverage Overview

- **Frontend**: 1,671 tests with Jest and React Testing Library
- **Backend**: 271 tests with pytest and mongomock
- **Coverage Target**: 70% minimum for both frontend and backend
- **Total Test Suite**: Comprehensive end-to-end testing including component, service, and integration tests

### Frontend Testing

```bash
cd frontend

# Run all tests (1,671 tests)
npm test

# Run tests with coverage reporting
npm run coverage

# TypeScript type checking
npx tsc --noEmit

# Run specific test file
npm test -- --testPathPattern=CompactRecipeCard
```

### Backend Testing

```bash
cd backend
source venv/bin/activate

# Run all tests (271 tests)
pytest

# Run tests with coverage reporting
pytest --cov

# Run specific test module
pytest tests/test_ingredients.py

# Run tests with verbose output
pytest -v
```

### Quality Assurance

- **TypeScript**: Strict type checking across all frontend code
- **ESLint**: Code quality and consistency enforcement
- **Black + isort**: Python code formatting and import organization
- **CI/CD**: Automated testing on push and pull requests
- **Coverage Reports**: Integrated with Codecov for tracking

## 🧬 Yeast Attenuation Analytics

### Feature Status: Implemented (Pending Real-World Data)

The yeast attenuation analytics feature is **fully implemented** and ready for production use. This advanced feature tracks real-world yeast performance to provide more accurate fermentation predictions.

#### What's Implemented:

- ✅ **Database Schema**: Extended ingredient model with attenuation tracking fields
- ✅ **API Endpoints**: Complete backend support for attenuation data management
- ✅ **Frontend Dashboard**: AttenuationAnalytics page for visualizing yeast performance
- ✅ **Service Layer**: TypeScript services for attenuation data processing
- ✅ **Test Coverage**: Comprehensive testing for all attenuation functionality

#### What's Needed:

- 🔄 **Real Brewing Data**: Feature requires actual brew session data to populate analytics
- 🔄 **User Adoption**: Community engagement needed to build meaningful datasets
- 🔄 **Data Collection**: Integration with brew session completion workflows

#### Future Enhancements:

- 🚀 **Predictive Modeling**: Machine learning for attenuation prediction
- 🚀 **Environmental Factors**: Temperature and pH impact analysis
- 🚀 **Batch Comparisons**: Performance analysis across different batch sizes

The infrastructure is complete and waiting for real-world brewing data to deliver valuable insights to the homebrewing community.

## 🤖 AI Recipe Suggestions

### Feature Status: Production Ready ✅

The AI recipe suggestions system is **fully implemented** and actively helping brewers create better, more balanced recipes that meet BJCP style guidelines.

#### What's Implemented:

- ✅ **Style Compliance Analysis**: Full BJCP integration with multi-metric optimization (OG, FG, ABV, IBU, SRM)
- ✅ **Smart Base Malt Selection**: Intelligent malt recommendations based on beer style characteristics
- ✅ **Ingredient Addition System**: Smart malt addition for colour adjustments (Munich Dark when SRM is low AND OG/FG is low, Midnight Wheat if SRM is low but OG/FG in range)
- ✅ **Hop Timing Optimization**: IBU-focused hop timing suggestions with conservative brewing approach
- ✅ **Cascading Effects Prediction**: Accurate impact analysis for ingredient changes
- ✅ **Unified Suggestion System**: Single comprehensive suggestion combining all optimizations
- ✅ **Quality Control**: Stringent compliance checking with detailed user feedback

#### Key Features:

- 🎯 **Style-Aware Recommendations**: Automatically detects beer style characteristics (hop-forward, malt-forward, colour requirements)
- 🧮 **Real-Time Calculations**: Instant metric predictions for suggested ingredient changes
- 🔍 **Intelligent Conflict Resolution**: Priority-based merging of multiple optimization suggestions
- 📊 **Multi-Metric Optimization**: Simultaneous optimization across all brewing metrics
- ✅ **Comprehensive Validation**: Only shows "recipe looks good" when ALL style ranges are met

#### Technical Architecture:

- **EnhancedStyleComplianceService**: BJCP style analysis and optimization logic
- **SmartBaseMaltService**: Intelligent grain bill recommendations
- **CascadingEffectsService**: Recipe change prediction and impact analysis
- **AISuggestions Component**: Main UI with comprehensive optimization display

The AI suggestions system is actively improving recipe quality and helping brewers understand the relationships between ingredients and brewing metrics.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- All new frontend code should be written in TypeScript
- All new frontend tests should be written in TypeScript (.test.ts/.test.tsx)
- Maintain test coverage above 70%
- Run type checking before committing: `npx tsc --noEmit`
- Follow existing code conventions and patterns
