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
│   ├── requirements.txt
│   └── .env // Environment variables for setting database locations
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/ // Custom ReactJS hook implementations
│   │   ├── images/
│   │   ├── pages/
│   │   ├── services/
|   |   |   └── api.js // Low-level API client, Handles core HTTP functionality & Provides a centralized point for API configuration
|   |   |   └── RecipeService.js // Higher-level abstraction specifically for recipe-related operations
│   │   ├── styles/ // CSS for various frontend components
│   │   ├── utils/
|   |   |   └── formatUtils.js // Utility functions for formatting units for displaying to the end user
│   │   ├── App.js
│   │   └── index.js
│   ├── tests/ // Frontend tests
│   ├── package.json
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

1. Initialize the database:

```bash
cd backend
flask db upgrade
```

Note: When you first start the application, it will automatically check if ingredient data exists in the database. If none is found, it will seed the database with the initial ingredient data from the data/brewtracker.ingredients.json file. You don't need to run any additional commands for this.

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
