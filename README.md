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
│   ├── migrations/ // Database management
│   ├── models/ // Database models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── recipe.py
│   │   ├── ingredient.py
│   │   ├── recipe_ingredient.py // Join table for assigning ingredients to recipes
│   │   └── brew_session.py
│   ├── routes/ // Backend routes for handling incoming HTTP requests
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── recipes.py
│   │   ├── ingredients.py
│   │   ├── recipe_ingredients.py
│   │   └── brew_sessions.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── db.py // Provides static methods for interacting with the database models related to users, recipes, and brew sessions
│   ├── tests/
│   ├── utils/
│   │   ├── __init__.py
│   │   └── helpers.py // Various brewing related calculations and formatters
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/ 
│   │   ├── images/
│   │   ├── pages/
│   │   ├── services/
|   |   |   └── api.js // API for communictating with the backend server
│   │   ├── utils/
|   |   |   └── recipeCalculations.js // Frontend recipe metric calculations for recipes not added to the database yet (less accurate than backend calcs)
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── .env
└── README.md // The document you are currently reading!
```

## 📋 Requirements

- Node.js (v16+)
- Python (v3.13+)
- PostgreSQL

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

3. Set up PostgreSQL:
```bash
brew services start postgresql
createdb brewtracker
createdb brewtracker_test
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
DATABASE_URL="postgresql://localhost:5432/brewtracker"
JWT_SECRET_KEY="your_secret_key_here"
FLASK_APP="app.py"
FLASK_ENV="development"
```

### 📦 Database Setup

1. Initialize the database:
```bash
cd backend
flask db upgrade
flask seed run  # If you have seed data
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
  - SQLAlchemy
  - JWT Authentication
  - PostgreSQL

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


