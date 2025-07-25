#!/bin/bash

# Test setup script for local development and CI

set -e

echo "🚀 Setting up test environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Create test directories if they don't exist
mkdir -p coverage
mkdir -p logs/test
mkdir -p performance-results

# Set up test environment variables
export NODE_ENV=test
export MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017/jomobit-test"}
export REDIS_URL=${REDIS_URL:-"redis://localhost:6379"}
export JWT_SECRET=${JWT_SECRET:-"test-jwt-secret"}
export AUTH0_DOMAIN=${AUTH0_DOMAIN:-"test.auth0.com"}
export AUTH0_AUDIENCE=${AUTH0_AUDIENCE:-"test-audience"}

# Check if MongoDB is running (for local development)
if [ "$CI" != "true" ]; then
    echo "🔍 Checking MongoDB connection..."
    if ! mongosh --eval "db.runCommand({ping: 1})" --quiet > /dev/null 2>&1; then
        echo "⚠️  MongoDB is not running. Tests will use MongoDB Memory Server."
    else
        echo "✅ MongoDB is running and accessible."
    fi

    echo "🔍 Checking Redis connection..."
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "⚠️  Redis is not running. Some integration tests may fail."
    else
        echo "✅ Redis is running and accessible."
    fi
fi

echo "✅ Test environment setup complete!"

# Run the requested test command
if [ $# -gt 0 ]; then
    echo "🧪 Running: $@"
    exec "$@"
else
    echo "💡 Usage: $0 [test-command]"
    echo "   Examples:"
    echo "     $0 npm run test:unit"
    echo "     $0 npm run test:integration"
    echo "     $0 npm run test:e2e"
    echo "     $0 npm run test:coverage"
fi