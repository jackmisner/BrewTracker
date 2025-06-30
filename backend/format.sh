#!/bin/bash

# Backend Code Formatting Script
# Runs Black, isort, and flake8 checks

echo "🎨 Formatting Python code with Black..."
black .

echo "📦 Organizing imports with isort..."
isort .

echo "✅ Code formatting complete!"