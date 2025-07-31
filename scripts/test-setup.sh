#!/bin/bash

# Enhanced test setup script for local development and CI
# Now includes comprehensive Swagger API documentation validation

set -e

echo "🚀 Setting up enhanced test environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_swagger() {
    echo -e "${PURPLE}[SWAGGER]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm ci
    print_success "Dependencies installed"
else
    print_status "Dependencies already installed"
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

# Swagger testing specific variables
export API_BASE_URL=${API_BASE_URL:-"http://localhost:3000"}
export VERBOSE=${VERBOSE:-false}
export SKIP_SERVER_START=${SKIP_SERVER_START:-false}

# Check if MongoDB is running (for local development)
if [ "$CI" != "true" ]; then
    print_status "Checking MongoDB connection..."
    if ! mongosh --eval "db.runCommand({ping: 1})" --quiet > /dev/null 2>&1; then
        print_warning "MongoDB is not running. Tests will use MongoDB Memory Server."
    else
        print_success "MongoDB is running and accessible."
    fi

    print_status "Checking Redis connection..."
    if ! redis-cli ping > /dev/null 2>&1; then
        print_warning "Redis is not running. Some integration tests may fail."
    else
        print_success "Redis is running and accessible."
    fi
fi

print_success "Test environment setup complete!"

# Function to run comprehensive test suite
run_comprehensive_tests() {
    print_status "Running comprehensive test suite including Swagger validation..."
    
    # Standard test suite
    print_status "Phase 1: Running standard test suite..."
    
    if npm run test:unit --silent; then
        print_success "Unit tests passed"
    else
        print_warning "Some unit tests failed"
    fi
    
    if npm run test:integration --silent; then
        print_success "Integration tests passed"
    else
        print_warning "Some integration tests failed"
    fi
    
    if npm run test:e2e --silent; then
        print_success "End-to-end tests passed"
    else
        print_warning "Some e2e tests failed"
    fi
    
    # Swagger validation
    print_swagger "Phase 2: Running Swagger API documentation validation..."
    
    if [ -z "$TEST_JWT_TOKEN" ]; then
        print_warning "TEST_JWT_TOKEN not provided. Some authenticated endpoint tests will be skipped."
    fi
    
    if [ -z "$ADMIN_JWT_TOKEN" ]; then
        print_warning "ADMIN_JWT_TOKEN not provided. Admin endpoint tests will be skipped."
    fi
    
    if node scripts/validate-swagger-documentation.js; then
        print_success "Swagger validation completed successfully!"
    else
        print_error "Swagger validation found issues. Check swagger-validation-report.json for details."
    fi
    
    # Additional Swagger tests
    print_swagger "Phase 3: Running additional Swagger endpoint tests..."
    
    if node scripts/test-swagger-endpoints.js; then
        print_success "Additional Swagger tests completed!"
    else
        print_warning "Additional Swagger tests found some issues. Check swagger-test-report.json for details."
    fi
    
    # Generate summary
    echo ""
    print_success "🎉 Comprehensive test suite completed!"
    echo ""
    print_status "Generated Reports:"
    [ -f "swagger-validation-report.json" ] && echo "  📄 swagger-validation-report.json - Detailed validation results"
    [ -f "swagger-test-report.json" ] && echo "  📄 swagger-test-report.json - Additional endpoint test results"
    [ -d "coverage" ] && echo "  📊 coverage/ - Code coverage reports"
    
    echo ""
    print_status "For complete Swagger testing, provide authentication tokens:"
    echo "  TEST_JWT_TOKEN=your_token ADMIN_JWT_TOKEN=admin_token $0 --comprehensive"
}

# Function to run only Swagger validation
run_swagger_validation() {
    print_swagger "Running Swagger API documentation validation only..."
    
    if [ -z "$TEST_JWT_TOKEN" ]; then
        print_warning "TEST_JWT_TOKEN not provided. Set it for complete testing:"
        echo "  TEST_JWT_TOKEN=your_token $0 --swagger"
    fi
    
    if [ -z "$ADMIN_JWT_TOKEN" ]; then
        print_warning "ADMIN_JWT_TOKEN not provided. Set it for admin endpoint testing:"
        echo "  ADMIN_JWT_TOKEN=admin_token $0 --swagger"
    fi
    
    if node scripts/validate-swagger-documentation.js; then
        print_success "Swagger validation completed successfully!"
    else
        print_error "Swagger validation found issues. Check the report for details."
        exit 1
    fi
}

# Parse command line arguments
case "${1:-}" in
    --comprehensive)
        run_comprehensive_tests
        ;;
    --swagger)
        run_swagger_validation
        ;;
    --help|-h)
        echo "Enhanced Test Setup Script"
        echo ""
        echo "Usage: $0 [option|test-command]"
        echo ""
        echo "Options:"
        echo "  --comprehensive    Run all tests including Swagger validation"
        echo "  --swagger         Run only Swagger API documentation validation"
        echo "  --help, -h        Show this help message"
        echo ""
        echo "Standard test commands:"
        echo "  npm run test:unit        Run unit tests only"
        echo "  npm run test:integration Run integration tests only"
        echo "  npm run test:e2e         Run end-to-end tests only"
        echo "  npm run test:coverage    Run tests with coverage"
        echo ""
        echo "Environment variables for Swagger testing:"
        echo "  TEST_JWT_TOKEN     JWT token for authenticated endpoint testing"
        echo "  ADMIN_JWT_TOKEN    JWT token for admin endpoint testing"
        echo "  VERBOSE=true       Enable verbose output"
        echo "  API_BASE_URL       Base URL for API testing (default: http://localhost:3000)"
        echo ""
        echo "Examples:"
        echo "  $0 --comprehensive"
        echo "  $0 --swagger"
        echo "  TEST_JWT_TOKEN=abc123 ADMIN_JWT_TOKEN=xyz789 $0 --comprehensive"
        echo "  VERBOSE=true $0 --swagger"
        ;;
    "")
        # No arguments - show usage
        echo "💡 Enhanced Test Setup Script"
        echo ""
        echo "Quick start:"
        echo "  $0 --comprehensive    # Run all tests including Swagger validation"
        echo "  $0 --swagger         # Run only Swagger validation"
        echo "  $0 --help           # Show detailed help"
        echo ""
        echo "Standard Jest commands:"
        echo "  $0 npm run test:unit"
        echo "  $0 npm run test:integration"
        echo "  $0 npm run test:e2e"
        echo "  $0 npm run test:coverage"
        ;;
    *)
        # Run the provided command
        print_status "Running custom command: $*"
        exec "$@"
        ;;
esac