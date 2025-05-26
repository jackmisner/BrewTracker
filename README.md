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
│   ├── app.py
│   ├── config.py
│   ├── data/ // Seed data for Ingredients
│   ├── models/ // Database models
│   │   ├── __init__.py
│   │   └── mongo_models.py // MongoDB models for users, recipes, ingredients, and brew sessions
│   ├── routes/ // Backend routes for handling incoming HTTP requests
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── recipes.py
│   │   ├── ingredients.py
│   │   └── brew_sessions.py
│   ├── seed_ingredients.py // Script that gets called on first run if database has no ingredients in it to add the ingredients data to DB
│   ├── services/
│   │   ├── __init__.py
│   │   └── mongodb_service.py // Provides methods for interacting with MongoDB
│   ├── tests/ // Backend tests
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── brewing_calculation_core.py  # Core brewing calculation formulae
│   │   ├── recipe_orm_calculator.py     # Calculations for database models
│   │   └── recipe_api_calculator.py     # Calculations for API preview requests
│   ├── requirements.txt // Backend requirements
│   └── .env // Environment variables for setting database locations
├── frontend/
│   ├── public/
│   │   ├── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── BrewSessions/ // Components used for Brew Sessions ("Brewing" a recipe and tracking fermentation stats)
│   │   │   ├── Header/ // Website header component with navigation buttons
│   │   │   ├── RecipeBuilder/ // Components used for creating recipes
│   │   │   ├── RecipeCard.js
│   │   │   ├── RecipeCardContainer.js
│   │   │   └── RecipeActions.js
│   │   ├── hooks/ // Custom ReactJS hook implementations
│   │   ├── images/
│   │   ├── pages/
│   │   │   ├── AllRecipes.js
│   │   │   ├── Dashboard.js
│   │   │   ├── RecipeBuilder.js
│   │   │   └── ViewRecipe.js
│   │   ├── services/
|   |   |   └── api.js // Low-level API client, Handles core HTTP functionality & Provides a centralized point for API configuration
│   │   │   ├── index.js // Central export for all business logic services, provides a clean interface for importing services throughout the application
│   │   │   ├── IngredientService.js // Higher-level abstraction specifically for ingredient-related operations
│   │   │   ├── MetricService.js // Higher-level abstraction specifically for metric-calculation operations
|   |   |   └── RecipeService.js // Higher-level abstraction specifically for recipe-related operations
│   │   ├── styles/ // CSS for various frontend components
│   │   ├── utils/
|   |   |   └── formatUtils.js // Utility functions for formatting units for displaying to the end user
│   │   ├── App.js
│   │   └── index.js
│   ├── tests/ // Frontend tests
│   ├── package.json // Frontend requirements
│   └── .env // Environment variable for linking frontend to backend
└── README.md // The document you are currently reading!
```

## 📋 Requirements

- Node.js (v16+)
- Python (v3.13+)
- MongoDB (v7.0+)

## 🚀 Quickstart

### 📥 Install Dependencies

1. Install Node.js using NVM:

```bash
brew install nvm
nvm install 16
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

3. Start MongoDB:

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
3. If no ingredients are found, it will automatically seed the database with initial ingredient data from `backend/data/brewtracker.ingredients.json`

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

  - React
  - React Router
  - Axios

- Backend:
  - Flask
  - MongoEngine & PyMongo
  - JWT Authentication
  - MongoDB

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
