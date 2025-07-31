# Chapter 2: Getting Started

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Development Server](#development-server)
- [Testing Setup](#testing-setup)
- [Docker Setup](#docker-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before setting up the Jomobit backend API, ensure you have the following installed:

### Required Software

| Software | Minimum Version | Recommended Version | Purpose |
|----------|----------------|-------------------|---------|
| **Node.js** | 18.0.0 | 20.x LTS | JavaScript runtime |
| **npm** | 9.0.0 | Latest | Package manager |
| **MongoDB** | 6.0 | 7.x | Primary database |
| **Redis** | 6.0 | 7.x | Caching and sessions |
| **Git** | 2.30 | Latest | Version control |

### External Services

You'll need accounts and API keys for:

| Service | Purpose | Required For |
|---------|---------|--------------|
| **Auth0** | User authentication | Core functionality |
| **OpenAI** | AI text generation | Poster generation |
| **Google Gemini** | Alternative AI provider | Optional AI provider |
| **Ideogram AI** | Image generation | Poster generation |
| **ImageKit** | CDN and image optimization | Image storage |
| **Razorpay** | Payment processing | Billing (optional for dev) |

### Development Tools (Recommended)

- **MongoDB Compass**: GUI for MongoDB
- **Redis Insight**: GUI for Redis
- **Postman**: API testing
- **VS Code**: Code editor with Node.js extensions

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd jomobit-backend
```

### 2. Install Dependencies

```bash
# Install production and development dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Verify Node.js Setup

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check available scripts
npm run
```

## Environment Configuration

### 1. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env
```

### 2. Configure Environment Variables

Edit the `.env` file with your specific configuration:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/jomobit
REDIS_URL=redis://localhost:6379

# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=https://api.jomobit.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_WEBHOOK_SECRET=your-webhook-secret

# AI Provider Configuration
OPENAI_API_KEY=sk-your-openai-key
OPENAI_WEBHOOK_SECRET=your-openai-webhook-secret
GEMINI_API_KEY=your-gemini-key
IDEOGRAM_API_KEY=your-ideogram-key
IDEOGRAM_WEBHOOK_SECRET=your-ideogram-webhook-secret

# Image Storage
IMAGEKIT_PUBLIC_KEY=your-imagekit-public-key
IMAGEKIT_PRIVATE_KEY=your-imagekit-private-key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id

# Payment Configuration (Optional for development)
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret

# Security Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
JWT_SECRET=your-jwt-secret-for-internal-use

# Logging Configuration
LOG_LEVEL=debug
LOG_FILE=logs/combined.log
ERROR_LOG_FILE=logs/error.log
```

### 3. Environment Variable Reference

#### Required for Core Functionality
- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string
- `AUTH0_DOMAIN`: Your Auth0 domain
- `AUTH0_AUDIENCE`: API identifier in Auth0
- `OPENAI_API_KEY`: OpenAI API key for text generation
- `IDEOGRAM_API_KEY`: Ideogram API key for image generation
- `IMAGEKIT_*`: ImageKit configuration for image storage

#### Optional for Development
- `RAZORPAY_*`: Payment processing (can be skipped for development)
- `GEMINI_API_KEY`: Alternative AI provider
- `WEBHOOK_SECRETS`: Required only if testing webhooks

#### Security & Performance
- `ALLOWED_ORIGINS`: CORS configuration
- `LOG_LEVEL`: Logging verbosity
- `NODE_ENV`: Environment mode

## Database Setup

### 1. MongoDB Setup

#### Local MongoDB Installation

**macOS (using Homebrew):**
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify MongoDB is running
mongosh --eval "db.adminCommand('ismaster')"
```

**Ubuntu/Debian:**
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### MongoDB Atlas (Cloud)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Configure network access (add your IP)
4. Create database user
5. Get connection string and update `MONGODB_URI`

### 2. Redis Setup

#### Local Redis Installation

**macOS (using Homebrew):**
```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
```

**Ubuntu/Debian:**
```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
```

#### Redis Cloud

1. Create account at [Redis Cloud](https://redis.com/redis-enterprise-cloud/)
2. Create a new database
3. Get connection string and update `REDIS_URL`

### 3. Database Initialization

The application will automatically create indexes and initial data on first run:

```bash
# Run database initialization
npm run start

# Check logs for successful database connection
tail -f logs/combined.log
```

## Development Server

### 1. Start Development Server

```bash
# Start with auto-reload
npm run dev

# Or start production mode
npm start
```

### 2. Verify Server is Running

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 45.123,
  "environment": "development"
}
```

### 3. Access API Documentation

Once the server is running, access the Swagger documentation:

- **Swagger UI**: http://localhost:3000/api-docs
- **API Endpoints**: http://localhost:3000/api

### 4. Development Workflow

```bash
# Install new dependencies
npm install package-name

# Run linting (if configured)
npm run lint

# Format code (if configured)
npm run format

# Check for security vulnerabilities
npm audit

# Update dependencies
npm update
```

## Testing Setup

### 1. Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

### 2. Test Database Setup

Tests use MongoDB Memory Server for isolation:

```bash
# Test database is automatically created/destroyed
# No manual setup required

# Check test configuration
cat jest.config.js
```

### 3. Test Environment Variables

Create `.env.test` for test-specific configuration:

```bash
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/jomobit-test
REDIS_URL=redis://localhost:6379/1
LOG_LEVEL=error
```

## Docker Setup

### 1. Docker Compose for Development

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/jomobit
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - mongo
      - redis
    command: npm run dev

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=jomobit

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

### 2. Run with Docker

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop services
docker-compose -f docker-compose.dev.yml down
```

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Issues

**Error**: `MongoNetworkError: failed to connect to server`

**Solutions**:
```bash
# Check if MongoDB is running
brew services list | grep mongodb
# or
sudo systemctl status mongod

# Check MongoDB logs
tail -f /usr/local/var/log/mongodb/mongo.log
# or
sudo journalctl -u mongod

# Restart MongoDB
brew services restart mongodb-community
# or
sudo systemctl restart mongod
```

#### 2. Redis Connection Issues

**Error**: `Error: Redis connection to localhost:6379 failed`

**Solutions**:
```bash
# Check if Redis is running
brew services list | grep redis
# or
sudo systemctl status redis-server

# Test Redis connection
redis-cli ping

# Restart Redis
brew services restart redis
# or
sudo systemctl restart redis-server
```

#### 3. Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

#### 4. Environment Variable Issues

**Error**: `Missing required Auth0 environment variables`

**Solutions**:
```bash
# Check if .env file exists
ls -la .env

# Verify environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.AUTH0_DOMAIN)"

# Check for typos in variable names
grep -n "AUTH0" .env
```

#### 5. Dependency Issues

**Error**: `Module not found` or version conflicts

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for peer dependency issues
npm ls

# Update to latest compatible versions
npm update
```

### Development Tips

#### 1. Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Use Node.js debugger
node --inspect server.js

# Debug specific modules
DEBUG=express:* npm run dev
```

#### 2. Database Inspection

```bash
# Connect to MongoDB
mongosh jomobit

# Show collections
show collections

# Query users
db.users.find().pretty()

# Connect to Redis
redis-cli

# List all keys
keys *

# Get specific key
get "user:session:123"
```

#### 3. API Testing

```bash
# Test authentication endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test health endpoint
curl http://localhost:3000/health

# Test with verbose output
curl -v http://localhost:3000/api/templates
```

### Performance Optimization

#### 1. Development Performance

```bash
# Use nodemon for faster restarts
npm install -g nodemon
nodemon server.js

# Enable source maps for debugging
NODE_OPTIONS="--enable-source-maps" npm run dev

# Monitor memory usage
node --max-old-space-size=4096 server.js
```

#### 2. Database Performance

```bash
# Monitor MongoDB performance
mongosh --eval "db.runCommand({serverStatus: 1})"

# Check slow queries
mongosh --eval "db.setProfilingLevel(2, {slowms: 100})"

# Monitor Redis performance
redis-cli --latency-history
```

---

**Next Chapter**: [Authentication & Security](./03-authentication-security.md) - Learn about Auth0 integration, JWT validation, and security measures.