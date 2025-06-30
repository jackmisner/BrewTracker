#!/bin/bash

# Backend Code Formatting Script
# Runs Black, isort, and flake8 checks

echo "🎨 Formatting Python code with Black..."
black .

echo "📦 Organizing imports with isort..."
isort .

echo "🔍 Running flake8 linting..."
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics

echo "✅ Code formatting complete!"