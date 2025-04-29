# Homebrew Tracker App - Project Structure

```
homebrew-tracker/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── recipe.py
│   │   └── brew_session.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── recipes.py
│   │   └── brew_sessions.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── db.py
│   ├── utils/
│   │   ├── __init__.py
│   │   └── helpers.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── .env.example
└── README.md
```
