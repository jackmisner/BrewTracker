# 🍺 BrewTracker

A comprehensive brewing management application that helps homebrewers create, manage, and track their beer recipes and brewing sessions.

## 🌟 About the Application

BrewTracker is a full-stack web application that enables homebrewers to:

- Create and manage beer recipes with detailed ingredients and metrics
- Calculate important brewing metrics (OG, FG, ABV, IBU, SRM)
- Track brewing sessions and fermentation progress
- View recipe statistics and brewing history

## 🏗️ Project Structure

This repository contains two applications:

- 🖥️ A frontend React App - User interface for recipe management
- 🔌 A backend Flask API - Python-based server handling recipe calculations and data storage

```
homebrew-tracker/
├── backend/
│   ├── app.py                                      # Flask application factory with auto-seeding, CORS, and blueprint registration
│   ├── config.py                                   # Environment-specific configuration classes (development, testing, production)
│   ├── data/                                       # Static JSON data files for ingredients and beer style guides
│   ├── models/                                     # Database models
│   │   ├── __init__.py
│   │   └── mongo_models.py                         # MongoEngine ODM models with validation, relationships, and business logic
│   ├── routes/                                     # Flask blueprints for API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py                                 # User authentication and authorization endpoints
│   │   ├── beer_styles.py                          # Beer style guide and analysis endpoints
│   │   ├── beerxml.py                              # BeerXML import/export functionality endpoints
│   │   ├── brew_sessions.py                        # Brew session tracking and fermentation management endpoints
│   │   ├── ingredients.py                          # Ingredient CRUD operations and search endpoints
│   │   ├── recipes.py                              # Recipe CRUD operations and calculation endpoints
│   │   └── user_settings.py                        # User preferences and account management endpoints
│   ├── seeds/                                      # Database seeding scripts
│   │   ├── seed_ingredients.py                     # Seeds ingredients from JSON data
│   │   └── seed_beer_styles.py                     # Seeds beer style guides from JSON data
│   ├── services/                                   # Business logic layer
│   │   ├── __init__.py
│   │   └── mongodb_service.py                      # Database abstraction layer with connection management and query utilities
│   ├── tests/                                      # pytest test suite for backend functionality
│   ├── utils/                                      # Utility functions
│   │   ├── __init__.py
│   │   ├── brewing_calculation_core.py             # Pure brewing mathematics (OG, FG, ABV, IBU, SRM calculations)
│   │   ├── recipe_orm_calculator.py                # Recipe calculations integrated with MongoDB models and validation
│   │   ├── recipe_api_calculator.py                # Real-time recipe calculations for API endpoints without database persistence
│   │   └── unit_conversions.py                     # Metric/imperial conversion utilities for weight, volume, and temperature
│   ├── requirements.txt                            # Python package dependencies for backend
│   └── .env                                        # Environment variables for database URI, JWT secrets, and Flask configuration
├── frontend/
│   ├── public/
│   │   ├── index.html                              # Main HTML template for React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── BeerXML/                            # BeerXML import/export components with ingredient matching and validation
│   │   │   ├── BrewSessions/                       # Brew session management with fermentation tracking and progress monitoring
│   │   │   ├── Header/                             # Application header with responsive navigation and user authentication status
│   │   │   ├── RecipeBuilder/                      # Complex recipe creation interface with real-time calculations and ingredient management
│   │   │   ├── RecipeActions.tsx                   # Action buttons for recipe operations (edit, delete, clone, share)
│   │   │   ├── RecipeCard.tsx                      # Individual recipe display card component
│   │   │   ├── RecipeCardContainer.tsx             # Container component for managing recipe card layout and state
│   │   │   └── SearchableSelect.ts                 # Fuzzy search component with Fuse.js for intelligent ingredient matching and suggestions
│   │   ├── contexts/
│   │   │   └── UnitContext.ts                      # React context for global metric/imperial unit preference management
│   │   ├── hooks/                                  # Custom React hooks for state management and business logic
│   │   │   ├── index.ts                            # Central export for all custom hooks
│   │   │   └── useRecipeBuilder.ts                 # Recipe builder state management and validation logic
│   │   ├── images/                                 # Static image assets (logos, icons, placeholders)
│   │   ├── pages/
│   │   │   ├── AllRecipes.tsx                      # Personal recipe library with search, filtering, and management tools
│   │   │   ├── Dashboard.tsx                       # User dashboard with recent activity, quick stats, and navigation shortcuts
│   │   │   ├── IngredientManager.tsx               # Ingredient database management with creation, editing, and bulk operations
│   │   │   ├── Login.tsx                           # User authentication login page
│   │   │   ├── PublicRecipes.tsx                   # Community recipe sharing with search and style filtering
│   │   │   ├── RecipeBuilder.tsx                   # Create and edit recipes with ingredient management
│   │   │   ├── Register.tsx                        # User registration page with account creation form
│   │   │   ├── UserSettings.tsx                    # User preferences for units, account details, and application settings
│   │   │   └── ViewRecipe.tsx                      # Detailed recipe view with calculations, brew sessions, and sharing options
│   │   ├── services/                               # TypeScript service layer for API communication and business logic
│   │   │   ├── BeerXML/                            # BeerXML format handling services
│   │   │   │   ├── BeerXMLService.ts               # BeerXML import/export and format conversion
│   │   │   │   └── IngredientMatchingService.ts    # Ingredient mapping and matching for BeerXML imports
│   │   │   ├── api.ts                              # Low-level HTTP client with authentication and error handling
│   │   │   ├── index.ts                            # Central export hub for all service modules
│   │   │   ├── BeerStyleService.ts                 # Beer style matching and analysis against BJCP guidelines
│   │   │   ├── BrewSessionService.ts               # Brew session tracking and fermentation data management
│   │   │   ├── CacheManager.ts                     # Client-side caching for improved performance
│   │   │   ├── IngredientService.ts                # Ingredient search, CRUD operations, and database management
│   │   │   ├── MetricService.ts                    # Recipe calculations (OG, FG, ABV, IBU, SRM) and analysis
│   │   │   ├── RecipeDefaultsService.ts            # Default value generation based on user preferences and recipe type
│   │   │   ├── RecipeService.ts                    # Recipe CRUD operations, cloning, and sharing functionality
│   │   │   └── UserSettingsService.ts              # User preferences, account management, and settings persistence
│   │   ├── styles/                                 # CSS for various frontend components
│   │   ├── types/                                  # Comprehensive TypeScript type definitions for BrewTracker
│   │   │   ├── api.ts                              # API request/response interface definitions
│   │   │   ├── beer-styles.ts                      # Beer style guide and analysis type definitions
│   │   │   ├── brew-session.ts                     # Brew session and fermentation tracking types
│   │   │   ├── common.ts                           # Shared utility types and common interfaces
│   │   │   ├── globals.d.ts                        # Global TypeScript declarations and module augmentations
│   │   │   ├── index.ts                            # Central export for all type definitions
│   │   │   ├── metrics.ts                          # Brewing calculation and measurement types
│   │   │   ├── recipe.ts                           # Recipe, ingredient, and calculation type definitions
│   │   │   ├── units.ts                            # Unit system and conversion type definitions
│   │   │   └── user.ts                             # User account and settings type definitions
│   │   ├── utils/
│   │   │   └── formatUtils.ts                      # Utility functions for unit formatting and display
│   │   ├── App.tsx                                 # Main React application component with routing and global providers
│   │   └── index.tsx                               # React application entry point and DOM rendering
│   ├── tests/                                      # Jest + TypeScript tests for React components and utilities
│   ├── package.json                                # Node.js dependencies, scripts, and project configuration
│   └── .env                                        # Environment variables for API URLs and frontend configuration
└── README.md                                       # The document you are currently reading!
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
  - Add/edit/delete recipes
  - Ingredient management
  - Automatic metric calculations
  - Cloning of existing recipes with linkages to parents recipe for version control
- 📊 Brewing Metrics
  - Original Gravity (OG)
  - Final Gravity (FG)
  - Alcohol By Volume (ABV)
  - International Bitterness Units (IBU)
  - Beer Colour in Standard Reference Method (SRM)
- 🔄 Brew Session Tracking

  - Track fermentation progress
  - Record brewing notes
  - Monitor temperature

- 👥 User Features
  - Secure authentication
  - Public/private recipe visibility

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

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Run tests with coverage
npm run coverage

# TypeScript type checking
npx tsc --noEmit
```

### Backend Testing

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run tests with coverage
pytest --cov
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- All new frontend code should be written in TypeScript
- All new frontend tests should be written in TypeScript (.test.ts/.test.tsx)
- Maintain test coverage above 70%
- Run type checking before committing: `npx tsc --noEmit`
- Follow existing code conventions and patterns
