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
- **Unit context**: `frontend/src/contexts/UnitContext.js` - Global metric/imperial preference management
- **Service layer**: `frontend/src/services/` - API abstractions for different domains
- **Custom hooks**: `frontend/src/hooks/useRecipeBuilder.js` - Complex recipe state management
- **Fuzzy search**: `frontend/src/components/SearchableSelect.js` - Fuse.js-powered ingredient search

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