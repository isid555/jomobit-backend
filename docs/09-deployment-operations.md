# Chapter 9: Deployment & Operations

## Table of Contents
- [Deployment Overview](#deployment-overview)
- [Environment Configuration](#environment-configuration)
- [Production Setup](#production-setup)
- [Container Deployment](#container-deployment)
- [Database Operations](#database-operations)
- [Monitoring & Logging](#monitoring--logging)
- [Performance Optimization](#performance-optimization)
- [Security Hardening](#security-hardening)
- [Backup & Recovery](#backup--recovery)
- [Scaling Strategies](#scaling-strategies)
- [Maintenance Procedures](#maintenance-procedures)
- [Incident Response](#incident-response)

## Deployment Overview

The Jomobit backend API is designed for cloud-native deployment with support for containerization, horizontal scaling, and high availability. This chapter covers production deployment strategies, operational procedures, and best practices for maintaining a robust system.

### Deployment Architecture

```mermaid
graph TB
    subgraph "Load Balancer Layer"
        LB[Load Balancer<br/>NGINX/ALB]
        SSL[SSL Termination]
    end
    
    subgraph "Application Layer"
        APP1[API Instance 1<br/>Node.js + Express]
        APP2[API Instance 2<br/>Node.js + Express]
        APP3[API Instance N<br/>Node.js + Express]
    end
    
    subgraph "Data Layer"
        MONGO_PRIMARY[(MongoDB Primary)]
        MONGO_SECONDARY[(MongoDB Secondary)]
        REDIS_MASTER[(Redis Master)]
        REDIS_REPLICA[(Redis Replica)]
    end
    
    subgraph "External Services"
        AUTH0[Auth0]
        AI_SERVICES[AI Providers]
        CDN[ImageKit CDN]
        PAYMENTS[Razorpay]
    end
    
    subgraph "Monitoring"
        LOGS[Centralized Logging]
        METRICS[Metrics Collection]
        ALERTS[Alert Manager]
    end
    
    LB --> SSL
    SSL --> APP1
    SSL --> APP2
    SSL --> APP3
    
    APP1 --> MONGO_PRIMARY
    APP2 --> MONGO_PRIMARY
    APP3 --> MONGO_PRIMARY
    
    MONGO_PRIMARY --> MONGO_SECONDARY
    
    APP1 --> REDIS_MASTER
    APP2 --> REDIS_MASTER
    APP3 --> REDIS_MASTER
    
    REDIS_MASTER --> REDIS_REPLICA
    
    APP1 --> AUTH0
    APP1 --> AI_SERVICES
    APP1 --> CDN
    APP1 --> PAYMENTS
    
    APP1 --> LOGS
    APP2 --> LOGS
    APP3 --> LOGS
    
    LOGS --> METRICS
    METRICS --> ALERTS
```

### Deployment Environments

1. **Development**: Local development with hot reloading
2. **Staging**: Production-like environment for testing
3. **Production**: Live environment serving real users
4. **DR (Disaster Recovery)**: Backup environment for failover

## Environment Configuration

### Environment Variables

```bash
# Application Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database Configuration
MONGODB_URI=mongodb://mongo-cluster:27017/jomobit
MONGODB_OPTIONS=retryWrites=true&w=majority&readPreference=primary

# Redis Configuration
REDIS_URL=redis://redis-cluster:6379
REDIS_PASSWORD=secure-redis-password
REDIS_DB=0

# Authentication
AUTH0_DOMAIN=jomobit.auth0.com
AUTH0_AUDIENCE=https://api.jomobit.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
JWT_SECRET=your-super-secure-jwt-secret-key

# AI Provider Configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_ORG_ID=org-your-openai-org-id
GEMINI_API_KEY=your-gemini-api-key
IDEOGRAM_API_KEY=your-ideogram-api-key

# CDN Configuration
IMAGEKIT_PUBLIC_KEY=public_your-imagekit-key
IMAGEKIT_PRIVATE_KEY=private_your-imagekit-key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id

# Payment Configuration
RAZORPAY_KEY_ID=rzp_live_your-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Security Configuration
CORS_ORIGIN=https://app.jomobit.com,https://admin.jomobit.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12

# Monitoring Configuration
LOG_LEVEL=info
LOG_FORMAT=json
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# Performance Configuration
CLUSTER_WORKERS=auto
MAX_REQUEST_SIZE=10mb
REQUEST_TIMEOUT=30000
KEEP_ALIVE_TIMEOUT=65000
```

### Configuration Management

```javascript
// src/config/environment.js
const config = {
  development: {
    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/jomobit-dev',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    },
    logging: {
      level: 'debug',
      format: 'combined'
    }
  },
  
  staging: {
    database: {
      uri: process.env.MONGODB_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority'
      }
    },
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  },
  
  production: {
    database: {
      uri: process.env.MONGODB_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
        readPreference: 'primary',
        compressors: ['zlib'],
        zlibCompressionLevel: 6
      }
    },
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: true,
      family: 4
    },
    logging: {
      level: 'warn',
      format: 'json'
    },
    cluster: {
      enabled: true,
      workers: process.env.CLUSTER_WORKERS || 'auto'
    }
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
```

## Production Setup

### Server Requirements

**Minimum Requirements:**
- CPU: 2 vCPUs
- RAM: 4GB
- Storage: 20GB SSD
- Network: 1Gbps

**Recommended Requirements:**
- CPU: 4 vCPUs
- RAM: 8GB
- Storage: 50GB SSD
- Network: 10Gbps

### System Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install NGINX for reverse proxy
sudo apt install nginx -y

# Install monitoring tools
sudo apt install htop iotop nethogs -y

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### Application Deployment

```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e

# Configuration
APP_NAME="jomobit-api"
APP_DIR="/opt/jomobit"
REPO_URL="https://github.com/your-org/jomobit-backend.git"
BRANCH="main"
USER="jomobit"

echo "Starting deployment of $APP_NAME..."

# Create application user if not exists
if ! id "$USER" &>/dev/null; then
    sudo useradd -r -s /bin/false $USER
fi

# Create application directory
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Switch to application user
sudo -u $USER bash << EOF
cd $APP_DIR

# Backup current version
if [ -d "current" ]; then
    mv current backup-\$(date +%Y%m%d-%H%M%S)
fi

# Clone latest code
git clone -b $BRANCH $REPO_URL current
cd current

# Install dependencies
npm ci --production

# Run database migrations if needed
npm run migrate

# Build application if needed
npm run build

# Update PM2 configuration
pm2 delete $APP_NAME || true
pm2 start ecosystem.config.js --env production
pm2 save
EOF

# Reload NGINX
sudo nginx -t && sudo systemctl reload nginx

echo "Deployment completed successfully!"
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'jomobit-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Process management
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,
    watch: false,
    
    // Performance
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }],
  
  deploy: {
    production: {
      user: 'jomobit',
      host: ['api1.jomobit.com', 'api2.jomobit.com'],
      ref: 'origin/main',
      repo: 'https://github.com/your-org/jomobit-backend.git',
      path: '/opt/jomobit',
      'post-deploy': 'npm ci --production && pm2 reload ecosystem.config.js --env production'
    }
  }
};
```

## Container Deployment

### Dockerfile

```dockerfile
# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application (if needed)
RUN npm run build || true

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S jomobit -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=jomobit:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=jomobit:nodejs /app/src ./src
COPY --from=builder --chown=jomobit:nodejs /app/package*.json ./
COPY --from=builder --chown=jomobit:nodejs /app/server.js ./

# Create logs directory
RUN mkdir -p logs && chown jomobit:nodejs logs

# Switch to non-root user
USER jomobit

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: jomobit/api:latest
    container_name: jomobit-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/jomobit
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    networks:
      - jomobit-network
    volumes:
      - ./logs:/app/logs
      - /etc/localtime:/etc/localtime:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mongo:
    image: mongo:7.0
    container_name: jomobit-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=secure-password
      - MONGO_INITDB_DATABASE=jomobit
    volumes:
      - mongo-data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - jomobit-network
    command: mongod --auth --bind_ip_all

  redis:
    image: redis:7-alpine
    container_name: jomobit-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --requirepass secure-redis-password --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - jomobit-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 3s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: jomobit-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - api
    networks:
      - jomobit-network

volumes:
  mongo-data:
    driver: local
  redis-data:
    driver: local

networks:
  jomobit-network:
    driver: bridge
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jomobit-api
  labels:
    app: jomobit-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: jomobit-api
  template:
    metadata:
      labels:
        app: jomobit-api
    spec:
      containers:
      - name: api
        image: jomobit/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: jomobit-secrets
              key: mongodb-uri
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: jomobit-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: jomobit-api-service
spec:
  selector:
    app: jomobit-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Database Operations

### MongoDB Production Setup

```javascript
// scripts/mongo-production-setup.js
// MongoDB production configuration and optimization

// Create production database and user
use admin;
db.createUser({
  user: "jomobit-api",
  pwd: "secure-production-password",
  roles: [
    { role: "readWrite", db: "jomobit" },
    { role: "dbAdmin", db: "jomobit" }
  ]
});

use jomobit;

// Create indexes for optimal performance
db.users.createIndex({ "auth0Id": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "status": 1 });
db.users.createIndex({ "createdAt": 1 });

db.businessprofiles.createIndex({ "userId": 1 });
db.businessprofiles.createIndex({ "status": 1 });
db.businessprofiles.createIndex({ "userId": 1, "status": 1 });

db.templates.createIndex({ "status": 1 });
db.templates.createIndex({ "category": 1, "status": 1 });
db.templates.createIndex({ "isPublic": 1, "status": 1 });
db.templates.createIndex({ "tags": 1 });

db.generationjobs.createIndex({ "userId": 1, "createdAt": -1 });
db.generationjobs.createIndex({ "status": 1 });
db.generationjobs.createIndex({ "externalJobId": 1 }, { unique: true, sparse: true });
db.generationjobs.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 2592000 }); // 30 days

db.creditwallets.createIndex({ "userId": 1 }, { unique: true });
db.credittransactions.createIndex({ "userId": 1, "createdAt": -1 });
db.credittransactions.createIndex({ "type": 1, "createdAt": -1 });

db.subscriptions.createIndex({ "userId": 1 });
db.subscriptions.createIndex({ "status": 1 });
db.subscriptions.createIndex({ "razorpaySubscriptionId": 1 }, { unique: true, sparse: true });

// Configure MongoDB for production
db.adminCommand({
  setParameter: 1,
  internalQueryPlannerMaxIndexedSolutions: 64,
  internalQueryPlannerEnableIndexIntersection: true,
  internalQueryExecMaxBlockingSortMemoryUsageBytes: 33554432
});
```

### Database Migrations

```javascript
// scripts/migrations/001-add-user-preferences.js
const mongoose = require('mongoose');

module.exports = {
  async up() {
    const User = mongoose.model('User');
    
    // Add preferences field to existing users
    await User.updateMany(
      { preferences: { $exists: false } },
      {
        $set: {
          preferences: {
            notifications: {
              email: true,
              push: true,
              marketing: false
            },
            theme: 'light',
            language: 'en'
          }
        }
      }
    );
    
    console.log('Added preferences to existing users');
  },
  
  async down() {
    const User = mongoose.model('User');
    
    // Remove preferences field
    await User.updateMany(
      {},
      { $unset: { preferences: 1 } }
    );
    
    console.log('Removed preferences from users');
  }
};
```

### Backup Strategy

```bash
#!/bin/bash
# scripts/backup-mongodb.sh

set -e

# Configuration
BACKUP_DIR="/opt/backups/mongodb"
RETENTION_DAYS=30
MONGODB_URI="mongodb://admin:password@localhost:27017/jomobit?authSource=admin"
S3_BUCKET="jomobit-backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Generate backup filename
BACKUP_NAME="jomobit-$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

echo "Starting MongoDB backup: $BACKUP_NAME"

# Create backup
mongodump --uri="$MONGODB_URI" --out="$BACKUP_PATH"

# Compress backup
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"

# Upload to S3 (if configured)
if [ ! -z "$S3_BUCKET" ]; then
    aws s3 cp "$BACKUP_PATH.tar.gz" "s3://$S3_BUCKET/mongodb/"
    echo "Backup uploaded to S3"
fi

# Clean old backups
find $BACKUP_DIR -name "jomobit-*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_PATH.tar.gz"
```

## Monitoring & Logging

### Application Monitoring

```javascript
// src/utils/monitoring.js
const winston = require('winston');
const { createPrometheusMetrics } = require('prom-client');

class MonitoringService {
  constructor() {
    this.setupLogger();
    this.setupMetrics();
    this.setupHealthChecks();
  }

  setupLogger() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'jomobit-api',
        version: process.env.npm_package_version,
        environment: process.env.NODE_ENV
      },
      transports: [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  setupMetrics() {
    const client = require('prom-client');
    
    // Default metrics
    client.collectDefaultMetrics({
      timeout: 10000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    // Custom metrics
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.httpRequestTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    });

    this.databaseOperations = new client.Histogram({
      name: 'database_operation_duration_seconds',
      help: 'Duration of database operations',
      labelNames: ['operation', 'collection'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.creditOperations = new client.Counter({
      name: 'credit_operations_total',
      help: 'Total credit operations',
      labelNames: ['type', 'status']
    });

    this.aiGenerations = new client.Counter({
      name: 'ai_generations_total',
      help: 'Total AI generations',
      labelNames: ['provider', 'status']
    });
  }

  setupHealthChecks() {
    this.healthChecks = {
      database: this.checkDatabase.bind(this),
      redis: this.checkRedis.bind(this),
      externalServices: this.checkExternalServices.bind(this)
    };
  }

  async checkDatabase() {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
      }
      
      await mongoose.connection.db.admin().ping();
      return { status: 'healthy', latency: Date.now() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async checkRedis() {
    try {
      const redis = require('../config/redis');
      const start = Date.now();
      await redis.ping();
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async checkExternalServices() {
    const services = ['auth0', 'openai', 'imagekit'];
    const results = {};

    for (const service of services) {
      try {
        // Implement service-specific health checks
        results[service] = { status: 'healthy' };
      } catch (error) {
        results[service] = { status: 'unhealthy', error: error.message };
      }
    }

    return results;
  }

  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);
    
    this.httpRequestTotal
      .labels(method, route, statusCode)
      .inc();
  }

  recordDatabaseOperation(operation, collection, duration) {
    this.databaseOperations
      .labels(operation, collection)
      .observe(duration);
  }

  recordCreditOperation(type, status) {
    this.creditOperations
      .labels(type, status)
      .inc();
  }

  recordAiGeneration(provider, status) {
    this.aiGenerations
      .labels(provider, status)
      .inc();
  }

  async getHealthStatus() {
    const checks = {};
    
    for (const [name, check] of Object.entries(this.healthChecks)) {
      try {
        checks[name] = await check();
      } catch (error) {
        checks[name] = { status: 'unhealthy', error: error.message };
      }
    }

    const overall = Object.values(checks).every(check => check.status === 'healthy')
      ? 'healthy' : 'unhealthy';

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version
    };
  }
}

module.exports = new MonitoringService();
```

### NGINX Configuration

```nginx
# nginx/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    # Upstream configuration
    upstream jomobit_api {
        least_conn;
        server api:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # Main server configuration
    server {
        listen 80;
        server_name api.jomobit.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.jomobit.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/jomobit.crt;
        ssl_certificate_key /etc/nginx/ssl/jomobit.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Health check endpoint
        location /health {
            access_log off;
            proxy_pass http://jomobit_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Metrics endpoint (restricted)
        location /metrics {
            allow 10.0.0.0/8;
            allow 172.16.0.0/12;
            allow 192.168.0.0/16;
            deny all;
            
            proxy_pass http://jomobit_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Authentication endpoints (stricter rate limiting)
        location ~ ^/api/(auth|register|login) {
            limit_req zone=auth burst=10 nodelay;
            
            proxy_pass http://jomobit_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
            proxy_http_version 1.1;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://jomobit_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
            proxy_http_version 1.1;
            
            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Webhook endpoints (no rate limiting)
        location /webhooks/ {
            proxy_pass http://jomobit_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
            proxy_http_version 1.1;
        }
    }
}
```

## Performance Optimization

### Application Performance

```javascript
// src/middleware/performance.js
const compression = require('compression');
const helmet = require('helmet');
const cluster = require('cluster');
const os = require('os');

class PerformanceOptimizer {
  static setupCompression(app) {
    app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024,
      memLevel: 8
    }));
  }

  static setupSecurity(app) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));
  }

  static setupClustering() {
    if (process.env.NODE_ENV === 'production' && cluster.isMaster) {
      const numWorkers = process.env.CLUSTER_WORKERS === 'auto' 
        ? os.cpus().length 
        : parseInt(process.env.CLUSTER_WORKERS) || 1;

      console.log(`Master ${process.pid} is running`);
      console.log(`Starting ${numWorkers} workers`);

      // Fork workers
      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }

      // Handle worker exit
      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        console.log('Starting a new worker');
        cluster.fork();
      });

      return false; // Don't start the app in master process
    }
    
    return true; // Start the app in worker process
  }

  static setupConnectionPooling() {
    // MongoDB connection pooling
    const mongooseOptions = {
      maxPoolSize: process.env.NODE_ENV === 'production' ? 50 : 10,
      minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false
    };

    // Redis connection pooling
    const redisOptions = {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxLoadingTimeout: 5000,
      lazyConnect: true,
      keepAlive: true,
      family: 4
    };

    return { mongooseOptions, redisOptions };
  }

  static setupCaching(app) {
    const redis = require('../config/redis');
    
    // Response caching middleware
    const cacheMiddleware = (duration = 300) => {
      return async (req, res, next) => {
        if (req.method !== 'GET') {
          return next();
        }

        const key = `cache:${req.originalUrl}`;
        
        try {
          const cached = await redis.get(key);
          if (cached) {
            return res.json(JSON.parse(cached));
          }

          // Override res.json to cache the response
          const originalJson = res.json;
          res.json = function(data) {
            redis.setex(key, duration, JSON.stringify(data));
            return originalJson.call(this, data);
          };

          next();
        } catch (error) {
          next();
        }
      };
    };

    return cacheMiddleware;
  }

  static setupRequestOptimization(app) {
    // Request timeout
    app.use((req, res, next) => {
      req.setTimeout(30000, () => {
        res.status(408).json({ error: 'Request timeout' });
      });
      next();
    });

    // Request size limiting
    app.use(express.json({ 
      limit: process.env.MAX_REQUEST_SIZE || '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));

    app.use(express.urlencoded({ 
      extended: true, 
      limit: process.env.MAX_REQUEST_SIZE || '10mb' 
    }));
  }
}

module.exports = PerformanceOptimizer;
```

### Database Optimization

```javascript
// src/utils/databaseOptimization.js
const mongoose = require('mongoose');

class DatabaseOptimizer {
  static setupOptimizations() {
    // Connection optimization
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferMaxEntries', 0);
    
    // Query optimization
    mongoose.set('strictQuery', true);
    mongoose.set('sanitizeFilter', true);
    
    // Performance monitoring
    mongoose.set('debug', process.env.NODE_ENV === 'development');
  }

  static createOptimizedQuery(model, conditions = {}, options = {}) {
    const query = model.find(conditions);
    
    // Apply lean for read-only operations
    if (options.lean !== false) {
      query.lean();
    }
    
    // Apply select for field projection
    if (options.select) {
      query.select(options.select);
    }
    
    // Apply population with field selection
    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach(pop => query.populate(pop));
      } else {
        query.populate(options.populate);
      }
    }
    
    // Apply sorting
    if (options.sort) {
      query.sort(options.sort);
    }
    
    // Apply pagination
    if (options.limit) {
      query.limit(options.limit);
    }
    
    if (options.skip) {
      query.skip(options.skip);
    }
    
    return query;
  }

  static async createAggregationPipeline(model, pipeline, options = {}) {
    const aggregation = model.aggregate(pipeline);
    
    // Add explain for development
    if (process.env.NODE_ENV === 'development' && options.explain) {
      const explanation = await aggregation.explain();
      console.log('Aggregation explanation:', JSON.stringify(explanation, null, 2));
    }
    
    return aggregation;
  }

  static setupIndexes() {
    // This would be called during application startup
    const models = [
      'User', 'BusinessProfile', 'Template', 'GenerationJob',
      'CreditWallet', 'CreditTransaction', 'Subscription', 'Plan'
    ];

    models.forEach(modelName => {
      const model = mongoose.model(modelName);
      
      // Ensure indexes are created
      model.ensureIndexes((err) => {
        if (err) {
          console.error(`Error creating indexes for ${modelName}:`, err);
        } else {
          console.log(`Indexes created for ${modelName}`);
        }
      });
    });
  }

  static async analyzeSlowQueries() {
    const db = mongoose.connection.db;
    
    // Enable profiling for slow queries (>100ms)
    await db.admin().command({
      profile: 2,
      slowms: 100,
      sampleRate: 0.1
    });
    
    // Get slow queries
    const slowQueries = await db.collection('system.profile')
      .find({ ts: { $gte: new Date(Date.now() - 3600000) } }) // Last hour
      .sort({ ts: -1 })
      .limit(10)
      .toArray();
    
    return slowQueries;
  }
}

module.exports = DatabaseOptimizer;
```

## Security Hardening

### Application Security

```javascript
// src/middleware/security.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

class SecurityHardening {
  static setupRateLimiting(app) {
    // General API rate limiting
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/ready';
      }
    });

    // Strict rate limiting for authentication endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 requests per windowMs
      message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    // Progressive delay for repeated requests
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50, // allow 50 requests per windowMs without delay
      delayMs: 500, // add 500ms delay per request after delayAfter
      maxDelayMs: 20000, // maximum delay of 20 seconds
    });

    app.use('/api/', generalLimiter);
    app.use('/api/auth/', authLimiter);
    app.use('/api/', speedLimiter);
  }

  static setupInputSanitization(app) {
    // Prevent NoSQL injection attacks
    app.use(mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        console.warn(`Sanitized key ${key} in request from ${req.ip}`);
      }
    }));

    // Prevent XSS attacks
    app.use(xss());

    // Prevent HTTP Parameter Pollution
    app.use(hpp({
      whitelist: ['tags', 'categories', 'sort'] // Allow arrays for these parameters
    }));
  }

  static setupSecurityHeaders(app) {
    app.use((req, res, next) => {
      // Remove server information
      res.removeHeader('X-Powered-By');
      
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // HSTS header for HTTPS
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }
      
      next();
    });
  }

  static setupCSRFProtection(app) {
    const csrf = require('csurf');
    
    // CSRF protection for state-changing operations
    const csrfProtection = csrf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      },
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
      skip: (req) => {
        // Skip CSRF for API endpoints with JWT authentication
        return req.path.startsWith('/api/') && req.headers.authorization;
      }
    });

    app.use(csrfProtection);
  }

  static setupRequestValidation() {
    return (schema) => {
      return (req, res, next) => {
        const { error } = schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false
        });

        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context.value
          }));

          return res.status(400).json({
            error: 'Validation failed',
            details: errors
          });
        }

        next();
      };
    };
  }

  static setupSecurityLogging(app) {
    app.use((req, res, next) => {
      // Log suspicious activities
      const suspiciousPatterns = [
        /\.\.\//,  // Directory traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection attempts
        /javascript:/i, // JavaScript protocol
        /data:.*base64/i // Data URLs
      ];

      const userAgent = req.headers['user-agent'] || '';
      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(req.url) || 
        pattern.test(JSON.stringify(req.body)) || 
        pattern.test(userAgent)
      );

      if (isSuspicious) {
        console.warn('Suspicious request detected:', {
          ip: req.ip,
          userAgent,
          url: req.url,
          body: req.body,
          timestamp: new Date().toISOString()
        });
      }

      next();
    });
  }

  static setupWebhookSecurity() {
    const crypto = require('crypto');
    
    return (secretKey) => {
      return (req, res, next) => {
        const signature = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
        
        if (!signature) {
          return res.status(401).json({ error: 'Missing signature' });
        }

        const expectedSignature = crypto
          .createHmac('sha256', secretKey)
          .update(req.rawBody)
          .digest('hex');

        const providedSignature = signature.replace('sha256=', '');

        if (!crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(providedSignature, 'hex')
        )) {
          return res.status(401).json({ error: 'Invalid signature' });
        }

        next();
      };
    };
  }
}

module.exports = SecurityHardening;
```

### Server Security

```bash
#!/bin/bash
# scripts/security-hardening.sh

set -e

echo "Starting security hardening..."

# Update system packages
apt update && apt upgrade -y

# Install security tools
apt install -y fail2ban ufw unattended-upgrades

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Configure fail2ban
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

# Configure automatic security updates
cat > /etc/apt/apt.conf.d/50unattended-upgrades << EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# Secure SSH configuration
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# Restart services
systemctl restart fail2ban
systemctl restart ssh
systemctl enable unattended-upgrades

echo "Security hardening completed!"
```

This completes the first part of Chapter 9. The document covers deployment overview, environment configuration, production setup, container deployment, database operations, monitoring & logging, performance optimization, and security hardening. 

Would you like me to continue with the remaining sections (Backup & Recovery, Scaling Strategies, Maintenance Procedures, and Incident Response) to complete Chapter 9?## Bac
kup & Recovery

### Automated Backup System

```bash
#!/bin/bash
# scripts/backup-system.sh

set -e

# Configuration
BACKUP_ROOT="/opt/backups"
RETENTION_DAYS=30
S3_BUCKET="jomobit-backups"
NOTIFICATION_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Create backup directories
mkdir -p $BACKUP_ROOT/{mongodb,redis,application,logs}

# Function to send notifications
send_notification() {
    local message="$1"
    local status="$2"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🔄 Backup $status: $message\"}" \
        $NOTIFICATION_WEBHOOK
}

# MongoDB backup
backup_mongodb() {
    echo "Starting MongoDB backup..."
    
    local backup_name="mongodb-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_ROOT/mongodb/$backup_name"
    
    mongodump --uri="$MONGODB_URI" --out="$backup_path" --gzip
    
    # Compress and upload
    tar -czf "$backup_path.tar.gz" -C "$BACKUP_ROOT/mongodb" "$backup_name"
    rm -rf "$backup_path"
    
    aws s3 cp "$backup_path.tar.gz" "s3://$S3_BUCKET/mongodb/"
    
    echo "MongoDB backup completed: $backup_name.tar.gz"
}

# Redis backup
backup_redis() {
    echo "Starting Redis backup..."
    
    local backup_name="redis-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_ROOT/redis/$backup_name"
    
    # Create Redis backup
    redis-cli --rdb "$backup_path.rdb"
    gzip "$backup_path.rdb"
    
    aws s3 cp "$backup_path.rdb.gz" "s3://$S3_BUCKET/redis/"
    
    echo "Redis backup completed: $backup_name.rdb.gz"
}

# Application backup
backup_application() {
    echo "Starting application backup..."
    
    local backup_name="application-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_ROOT/application/$backup_name.tar.gz"
    
    # Backup application code and configuration
    tar -czf "$backup_path" \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='.git' \
        -C /opt/jomobit .
    
    aws s3 cp "$backup_path" "s3://$S3_BUCKET/application/"
    
    echo "Application backup completed: $backup_name.tar.gz"
}

# Log backup
backup_logs() {
    echo "Starting log backup..."
    
    local backup_name="logs-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_ROOT/logs/$backup_name.tar.gz"
    
    # Backup logs older than 1 day
    find /opt/jomobit/logs -name "*.log" -mtime +1 -exec tar -czf "$backup_path" {} +
    
    if [ -f "$backup_path" ]; then
        aws s3 cp "$backup_path" "s3://$S3_BUCKET/logs/"
        echo "Log backup completed: $backup_name.tar.gz"
    fi
}

# Cleanup old backups
cleanup_backups() {
    echo "Cleaning up old backups..."
    
    find $BACKUP_ROOT -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    find $BACKUP_ROOT -name "*.rdb.gz" -mtime +$RETENTION_DAYS -delete
    
    # Cleanup S3 backups older than retention period
    aws s3api list-objects-v2 --bucket $S3_BUCKET --query "Contents[?LastModified<='$(date -d "$RETENTION_DAYS days ago" --iso-8601)'].Key" --output text | \
    xargs -I {} aws s3 rm s3://$S3_BUCKET/{}
    
    echo "Cleanup completed"
}

# Main backup process
main() {
    echo "Starting backup process at $(date)"
    
    send_notification "Starting backup process" "STARTED"
    
    backup_mongodb
    backup_redis
    backup_application
    backup_logs
    cleanup_backups
    
    send_notification "Backup process completed successfully" "SUCCESS"
    
    echo "Backup process completed at $(date)"
}

# Run main function
main 2>&1 | tee -a /var/log/backup.log
```

### Disaster Recovery Plan

```javascript
// scripts/disaster-recovery.js
const mongoose = require('mongoose');
const Redis = require('ioredis');
const AWS = require('aws-sdk');

class DisasterRecovery {
  constructor() {
    this.s3 = new AWS.S3();
    this.bucket = process.env.BACKUP_S3_BUCKET;
  }

  async restoreFromBackup(backupDate, components = ['mongodb', 'redis', 'application']) {
    console.log(`Starting disaster recovery for ${backupDate}`);
    
    const results = {};
    
    for (const component of components) {
      try {
        results[component] = await this.restoreComponent(component, backupDate);
      } catch (error) {
        console.error(`Failed to restore ${component}:`, error);
        results[component] = { success: false, error: error.message };
      }
    }
    
    return results;
  }

  async restoreComponent(component, backupDate) {
    switch (component) {
      case 'mongodb':
        return await this.restoreMongoDB(backupDate);
      case 'redis':
        return await this.restoreRedis(backupDate);
      case 'application':
        return await this.restoreApplication(backupDate);
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  async restoreMongoDB(backupDate) {
    console.log('Restoring MongoDB...');
    
    // Download backup from S3
    const backupKey = `mongodb/mongodb-${backupDate}.tar.gz`;
    const localPath = `/tmp/mongodb-restore-${backupDate}.tar.gz`;
    
    await this.downloadFromS3(backupKey, localPath);
    
    // Extract backup
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec(`tar -xzf ${localPath} -C /tmp/`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Restore to MongoDB
    const restoreDir = `/tmp/mongodb-${backupDate}`;
    await new Promise((resolve, reject) => {
      exec(`mongorestore --uri="${process.env.MONGODB_URI}" --drop ${restoreDir}`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Cleanup
    exec(`rm -rf ${localPath} ${restoreDir}`);
    
    return { success: true, message: 'MongoDB restored successfully' };
  }

  async restoreRedis(backupDate) {
    console.log('Restoring Redis...');
    
    // Download backup from S3
    const backupKey = `redis/redis-${backupDate}.rdb.gz`;
    const localPath = `/tmp/redis-restore-${backupDate}.rdb.gz`;
    
    await this.downloadFromS3(backupKey, localPath);
    
    // Extract and restore
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec(`gunzip ${localPath}`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    const rdbPath = localPath.replace('.gz', '');
    
    // Stop Redis, replace RDB file, start Redis
    await new Promise((resolve, reject) => {
      exec(`
        sudo systemctl stop redis
        sudo cp ${rdbPath} /var/lib/redis/dump.rdb
        sudo chown redis:redis /var/lib/redis/dump.rdb
        sudo systemctl start redis
        rm ${rdbPath}
      `, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    return { success: true, message: 'Redis restored successfully' };
  }

  async restoreApplication(backupDate) {
    console.log('Restoring application...');
    
    // Download backup from S3
    const backupKey = `application/application-${backupDate}.tar.gz`;
    const localPath = `/tmp/application-restore-${backupDate}.tar.gz`;
    
    await this.downloadFromS3(backupKey, localPath);
    
    // Extract to temporary directory
    const { exec } = require('child_process');
    const tempDir = `/tmp/application-restore-${backupDate}`;
    
    await new Promise((resolve, reject) => {
      exec(`mkdir -p ${tempDir} && tar -xzf ${localPath} -C ${tempDir}`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Stop application, backup current, restore, restart
    await new Promise((resolve, reject) => {
      exec(`
        pm2 stop jomobit-api
        mv /opt/jomobit/current /opt/jomobit/backup-$(date +%Y%m%d-%H%M%S)
        mv ${tempDir} /opt/jomobit/current
        cd /opt/jomobit/current && npm ci --production
        pm2 start jomobit-api
        rm ${localPath}
      `, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    return { success: true, message: 'Application restored successfully' };
  }

  async downloadFromS3(key, localPath) {
    const params = {
      Bucket: this.bucket,
      Key: key
    };
    
    const data = await this.s3.getObject(params).promise();
    require('fs').writeFileSync(localPath, data.Body);
  }

  async listAvailableBackups() {
    const params = {
      Bucket: this.bucket,
      Prefix: ''
    };
    
    const data = await this.s3.listObjectsV2(params).promise();
    
    const backups = {};
    data.Contents.forEach(obj => {
      const parts = obj.Key.split('/');
      const component = parts[0];
      const filename = parts[1];
      
      if (!backups[component]) {
        backups[component] = [];
      }
      
      backups[component].push({
        filename,
        size: obj.Size,
        lastModified: obj.LastModified
      });
    });
    
    return backups;
  }

  async validateBackup(component, backupDate) {
    console.log(`Validating ${component} backup for ${backupDate}`);
    
    try {
      const backupKey = `${component}/${component}-${backupDate}.tar.gz`;
      await this.s3.headObject({
        Bucket: this.bucket,
        Key: backupKey
      }).promise();
      
      return { valid: true, message: 'Backup exists and is accessible' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = DisasterRecovery;
```

## Scaling Strategies

### Horizontal Scaling

```javascript
// src/config/scaling.js
class ScalingManager {
  constructor() {
    this.metrics = {
      cpu: 0,
      memory: 0,
      connections: 0,
      responseTime: 0,
      errorRate: 0
    };
    
    this.thresholds = {
      scaleUp: {
        cpu: 70,
        memory: 80,
        connections: 1000,
        responseTime: 2000,
        errorRate: 5
      },
      scaleDown: {
        cpu: 30,
        memory: 40,
        connections: 200,
        responseTime: 500,
        errorRate: 1
      }
    };
  }

  async checkScalingNeeds() {
    await this.collectMetrics();
    
    const scaleUp = this.shouldScaleUp();
    const scaleDown = this.shouldScaleDown();
    
    if (scaleUp) {
      return { action: 'scale-up', reason: scaleUp };
    } else if (scaleDown) {
      return { action: 'scale-down', reason: scaleDown };
    }
    
    return { action: 'none' };
  }

  async collectMetrics() {
    // CPU usage
    const cpuUsage = await this.getCPUUsage();
    this.metrics.cpu = cpuUsage;
    
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memory = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    // Active connections
    this.metrics.connections = this.getActiveConnections();
    
    // Response time (from monitoring)
    this.metrics.responseTime = await this.getAverageResponseTime();
    
    // Error rate
    this.metrics.errorRate = await this.getErrorRate();
  }

  shouldScaleUp() {
    const reasons = [];
    
    if (this.metrics.cpu > this.thresholds.scaleUp.cpu) {
      reasons.push(`CPU usage: ${this.metrics.cpu}%`);
    }
    
    if (this.metrics.memory > this.thresholds.scaleUp.memory) {
      reasons.push(`Memory usage: ${this.metrics.memory}%`);
    }
    
    if (this.metrics.connections > this.thresholds.scaleUp.connections) {
      reasons.push(`Active connections: ${this.metrics.connections}`);
    }
    
    if (this.metrics.responseTime > this.thresholds.scaleUp.responseTime) {
      reasons.push(`Response time: ${this.metrics.responseTime}ms`);
    }
    
    if (this.metrics.errorRate > this.thresholds.scaleUp.errorRate) {
      reasons.push(`Error rate: ${this.metrics.errorRate}%`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : null;
  }

  shouldScaleDown() {
    // Only scale down if all metrics are below thresholds
    const allLow = 
      this.metrics.cpu < this.thresholds.scaleDown.cpu &&
      this.metrics.memory < this.thresholds.scaleDown.memory &&
      this.metrics.connections < this.thresholds.scaleDown.connections &&
      this.metrics.responseTime < this.thresholds.scaleDown.responseTime &&
      this.metrics.errorRate < this.thresholds.scaleDown.errorRate;
    
    return allLow ? 'All metrics below scale-down thresholds' : null;
  }

  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const percentage = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(percentage, 100));
      }, 1000);
    });
  }

  getActiveConnections() {
    // This would integrate with your connection tracking
    return global.activeConnections || 0;
  }

  async getAverageResponseTime() {
    // This would integrate with your monitoring system
    const monitoring = require('../utils/monitoring');
    return monitoring.getAverageResponseTime();
  }

  async getErrorRate() {
    // This would integrate with your error tracking
    const monitoring = require('../utils/monitoring');
    return monitoring.getErrorRate();
  }
}

module.exports = ScalingManager;
```

### Load Balancing Configuration

```nginx
# nginx/load-balancer.conf
upstream jomobit_api {
    # Load balancing method
    least_conn;
    
    # Backend servers
    server api1.jomobit.internal:3000 max_fails=3 fail_timeout=30s weight=1;
    server api2.jomobit.internal:3000 max_fails=3 fail_timeout=30s weight=1;
    server api3.jomobit.internal:3000 max_fails=3 fail_timeout=30s weight=1;
    
    # Health check
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}

# Sticky sessions for WebSocket connections
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name api.jomobit.com;

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/jomobit.crt;
    ssl_certificate_key /etc/nginx/ssl/jomobit.key;

    # Load balancing
    location / {
        proxy_pass http://jomobit_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Health checks
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://jomobit_api;
        proxy_set_header Host $host;
    }
}
```

### Auto-scaling with Docker Swarm

```yaml
# docker-swarm.yml
version: '3.8'

services:
  api:
    image: jomobit/api:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 10s
        failure_action: pause
        order: stop-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      placement:
        constraints:
          - node.role == worker
        preferences:
          - spread: node.labels.zone
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - NODE_ENV=production
      - MONGODB_URI_FILE=/run/secrets/mongodb_uri
      - REDIS_URL_FILE=/run/secrets/redis_url
    secrets:
      - mongodb_uri
      - redis_url
      - jwt_secret
    networks:
      - jomobit-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == manager
    configs:
      - source: nginx_config
        target: /etc/nginx/nginx.conf
    networks:
      - jomobit-network
    depends_on:
      - api

networks:
  jomobit-network:
    driver: overlay
    attachable: true

secrets:
  mongodb_uri:
    external: true
  redis_url:
    external: true
  jwt_secret:
    external: true

configs:
  nginx_config:
    external: true
```

## Maintenance Procedures

### Scheduled Maintenance

```bash
#!/bin/bash
# scripts/maintenance.sh

set -e

# Configuration
MAINTENANCE_MODE_FILE="/opt/jomobit/maintenance.flag"
BACKUP_DIR="/opt/backups/maintenance"
LOG_FILE="/var/log/maintenance.log"

# Functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

enable_maintenance_mode() {
    log "Enabling maintenance mode..."
    touch $MAINTENANCE_MODE_FILE
    
    # Update load balancer to show maintenance page
    nginx -s reload
    
    # Wait for existing requests to complete
    sleep 30
    
    log "Maintenance mode enabled"
}

disable_maintenance_mode() {
    log "Disabling maintenance mode..."
    rm -f $MAINTENANCE_MODE_FILE
    
    # Update load balancer to resume normal operation
    nginx -s reload
    
    log "Maintenance mode disabled"
}

backup_before_maintenance() {
    log "Creating pre-maintenance backup..."
    
    mkdir -p $BACKUP_DIR
    
    # Database backup
    mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongodb-pre-maintenance"
    
    # Application backup
    tar -czf "$BACKUP_DIR/application-pre-maintenance.tar.gz" \
        --exclude='node_modules' \
        --exclude='logs' \
        -C /opt/jomobit .
    
    log "Pre-maintenance backup completed"
}

update_dependencies() {
    log "Updating dependencies..."
    
    cd /opt/jomobit/current
    
    # Update npm packages
    npm audit fix --production
    npm update --production
    
    # Update system packages
    apt update && apt upgrade -y
    
    log "Dependencies updated"
}

run_database_maintenance() {
    log "Running database maintenance..."
    
    # MongoDB maintenance
    mongo $MONGODB_URI --eval "
        db.runCommand({compact: 'users'});
        db.runCommand({compact: 'businessprofiles'});
        db.runCommand({compact: 'templates'});
        db.runCommand({compact: 'generationjobs'});
        db.runCommand({reIndex: 'users'});
        db.runCommand({reIndex: 'businessprofiles'});
        db.runCommand({reIndex: 'templates'});
        db.runCommand({reIndex: 'generationjobs'});
    "
    
    # Redis maintenance
    redis-cli BGREWRITEAOF
    
    log "Database maintenance completed"
}

cleanup_logs() {
    log "Cleaning up old logs..."
    
    # Rotate and compress old logs
    find /opt/jomobit/logs -name "*.log" -mtime +7 -exec gzip {} \;
    find /opt/jomobit/logs -name "*.log.gz" -mtime +30 -delete
    
    # Clean system logs
    journalctl --vacuum-time=30d
    
    log "Log cleanup completed"
}

restart_services() {
    log "Restarting services..."
    
    # Restart application
    pm2 restart jomobit-api
    
    # Restart supporting services
    systemctl restart nginx
    systemctl restart redis
    
    # Wait for services to be ready
    sleep 60
    
    # Health check
    if curl -f http://localhost:3000/health; then
        log "Services restarted successfully"
    else
        log "ERROR: Health check failed after restart"
        exit 1
    fi
}

run_health_checks() {
    log "Running post-maintenance health checks..."
    
    # API health check
    if ! curl -f http://localhost:3000/health; then
        log "ERROR: API health check failed"
        return 1
    fi
    
    # Database connectivity
    if ! mongo $MONGODB_URI --eval "db.adminCommand('ping')"; then
        log "ERROR: Database connectivity check failed"
        return 1
    fi
    
    # Redis connectivity
    if ! redis-cli ping; then
        log "ERROR: Redis connectivity check failed"
        return 1
    fi
    
    log "All health checks passed"
    return 0
}

# Main maintenance procedure
main() {
    log "Starting scheduled maintenance..."
    
    # Pre-maintenance steps
    backup_before_maintenance
    enable_maintenance_mode
    
    # Maintenance tasks
    update_dependencies
    run_database_maintenance
    cleanup_logs
    restart_services
    
    # Post-maintenance steps
    if run_health_checks; then
        disable_maintenance_mode
        log "Scheduled maintenance completed successfully"
    else
        log "ERROR: Maintenance failed health checks"
        log "System remains in maintenance mode"
        exit 1
    fi
}

# Run maintenance
main 2>&1 | tee -a $LOG_FILE
```

### Database Maintenance

```javascript
// scripts/database-maintenance.js
const mongoose = require('mongoose');

class DatabaseMaintenance {
  constructor() {
    this.db = mongoose.connection.db;
  }

  async runMaintenance() {
    console.log('Starting database maintenance...');
    
    const tasks = [
      this.cleanupExpiredSessions.bind(this),
      this.archiveOldGenerationJobs.bind(this),
      this.optimizeIndexes.bind(this),
      this.updateStatistics.bind(this),
      this.validateDataIntegrity.bind(this)
    ];
    
    const results = {};
    
    for (const task of tasks) {
      try {
        const taskName = task.name.replace('bound ', '');
        console.log(`Running ${taskName}...`);
        results[taskName] = await task();
        console.log(`${taskName} completed successfully`);
      } catch (error) {
        console.error(`${task.name} failed:`, error);
        results[task.name] = { error: error.message };
      }
    }
    
    return results;
  }

  async cleanupExpiredSessions() {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    const result = await this.db.collection('sessions').deleteMany({
      expires: { $lt: cutoffDate }
    });
    
    return { deletedSessions: result.deletedCount };
  }

  async archiveOldGenerationJobs() {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    
    // Find old completed jobs
    const oldJobs = await this.db.collection('generationjobs').find({
      status: 'completed',
      createdAt: { $lt: cutoffDate }
    }).toArray();
    
    if (oldJobs.length > 0) {
      // Archive to separate collection
      await this.db.collection('generationjobs_archive').insertMany(oldJobs);
      
      // Remove from main collection
      const result = await this.db.collection('generationjobs').deleteMany({
        _id: { $in: oldJobs.map(job => job._id) }
      });
      
      return { archivedJobs: result.deletedCount };
    }
    
    return { archivedJobs: 0 };
  }

  async optimizeIndexes() {
    const collections = ['users', 'businessprofiles', 'templates', 'generationjobs'];
    const results = {};
    
    for (const collectionName of collections) {
      try {
        // Reindex collection
        await this.db.collection(collectionName).reIndex();
        
        // Get index statistics
        const stats = await this.db.collection(collectionName).stats();
        results[collectionName] = {
          totalIndexSize: stats.totalIndexSize,
          indexCount: stats.nindexes
        };
      } catch (error) {
        results[collectionName] = { error: error.message };
      }
    }
    
    return results;
  }

  async updateStatistics() {
    const stats = {};
    
    // User statistics
    stats.users = {
      total: await this.db.collection('users').countDocuments(),
      active: await this.db.collection('users').countDocuments({ status: 'active' }),
      newThisMonth: await this.db.collection('users').countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      })
    };
    
    // Generation statistics
    stats.generations = {
      total: await this.db.collection('generationjobs').countDocuments(),
      completed: await this.db.collection('generationjobs').countDocuments({ status: 'completed' }),
      thisMonth: await this.db.collection('generationjobs').countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      })
    };
    
    // Credit statistics
    const creditStats = await this.db.collection('creditwallets').aggregate([
      {
        $group: {
          _id: null,
          totalCredits: { $sum: { $add: ['$defaultCredits', '$subscriptionCredits'] } },
          totalReserved: { $sum: '$reservedCredits' }
        }
      }
    ]).toArray();
    
    stats.credits = creditStats[0] || { totalCredits: 0, totalReserved: 0 };
    
    // Store statistics
    await this.db.collection('system_statistics').replaceOne(
      { type: 'monthly' },
      { type: 'monthly', data: stats, updatedAt: new Date() },
      { upsert: true }
    );
    
    return stats;
  }

  async validateDataIntegrity() {
    const issues = [];
    
    // Check for orphaned business profiles
    const orphanedProfiles = await this.db.collection('businessprofiles').aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $match: { user: { $size: 0 } } },
      { $project: { _id: 1, userId: 1 } }
    ]).toArray();
    
    if (orphanedProfiles.length > 0) {
      issues.push({
        type: 'orphaned_profiles',
        count: orphanedProfiles.length,
        ids: orphanedProfiles.map(p => p._id)
      });
    }
    
    // Check for credit wallets without users
    const orphanedWallets = await this.db.collection('creditwallets').aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $match: { user: { $size: 0 } } },
      { $project: { _id: 1, userId: 1 } }
    ]).toArray();
    
    if (orphanedWallets.length > 0) {
      issues.push({
        type: 'orphaned_wallets',
        count: orphanedWallets.length,
        ids: orphanedWallets.map(w => w._id)
      });
    }
    
    return { issues, totalIssues: issues.length };
  }
}

module.exports = DatabaseMaintenance;
```

## Incident Response

### Incident Response Plan

```javascript
// scripts/incident-response.js
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class IncidentResponse {
  constructor() {
    this.alertChannels = {
      slack: process.env.SLACK_WEBHOOK_URL,
      email: process.env.ALERT_EMAIL,
      sms: process.env.ALERT_SMS_ENDPOINT
    };
    
    this.severityLevels = {
      CRITICAL: { priority: 1, escalationTime: 5 }, // 5 minutes
      HIGH: { priority: 2, escalationTime: 15 },    // 15 minutes
      MEDIUM: { priority: 3, escalationTime: 60 },  // 1 hour
      LOW: { priority: 4, escalationTime: 240 }     // 4 hours
    };
  }

  async handleIncident(incident) {
    console.log(`Handling incident: ${incident.title}`);
    
    const response = {
      incidentId: this.generateIncidentId(),
      timestamp: new Date().toISOString(),
      severity: incident.severity,
      status: 'investigating',
      actions: []
    };
    
    // Immediate response based on incident type
    switch (incident.type) {
      case 'service_down':
        response.actions = await this.handleServiceDown(incident);
        break;
      case 'high_error_rate':
        response.actions = await this.handleHighErrorRate(incident);
        break;
      case 'database_issues':
        response.actions = await this.handleDatabaseIssues(incident);
        break;
      case 'security_breach':
        response.actions = await this.handleSecurityBreach(incident);
        break;
      default:
        response.actions = await this.handleGenericIncident(incident);
    }
    
    // Send alerts
    await this.sendAlert(incident, response);
    
    // Log incident
    await this.logIncident(incident, response);
    
    return response;
  }

  async handleServiceDown(incident) {
    const actions = [];
    
    // Check service status
    try {
      const healthCheck = await this.checkServiceHealth();
      actions.push({
        action: 'health_check',
        result: healthCheck,
        timestamp: new Date().toISOString()
      });
      
      if (!healthCheck.healthy) {
        // Attempt automatic restart
        const restartResult = await this.restartService();
        actions.push({
          action: 'service_restart',
          result: restartResult,
          timestamp: new Date().toISOString()
        });
        
        // Wait and check again
        await new Promise(resolve => setTimeout(resolve, 30000));
        const postRestartCheck = await this.checkServiceHealth();
        actions.push({
          action: 'post_restart_check',
          result: postRestartCheck,
          timestamp: new Date().toISOString()
        });
        
        if (!postRestartCheck.healthy) {
          // Escalate to manual intervention
          actions.push({
            action: 'escalate',
            reason: 'Service restart failed to resolve issue',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      actions.push({
        action: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    return actions;
  }

  async handleHighErrorRate(incident) {
    const actions = [];
    
    // Analyze error patterns
    const errorAnalysis = await this.analyzeErrors();
    actions.push({
      action: 'error_analysis',
      result: errorAnalysis,
      timestamp: new Date().toISOString()
    });
    
    // Check if it's a specific endpoint
    if (errorAnalysis.topErrorEndpoint) {
      // Temporarily disable problematic endpoint
      const disableResult = await this.disableEndpoint(errorAnalysis.topErrorEndpoint);
      actions.push({
        action: 'disable_endpoint',
        endpoint: errorAnalysis.topErrorEndpoint,
        result: disableResult,
        timestamp: new Date().toISOString()
      });
    }
    
    // Scale up if needed
    if (errorAnalysis.suggestScaling) {
      const scaleResult = await this.scaleUp();
      actions.push({
        action: 'scale_up',
        result: scaleResult,
        timestamp: new Date().toISOString()
      });
    }
    
    return actions;
  }

  async handleDatabaseIssues(incident) {
    const actions = [];
    
    // Check database connectivity
    const dbCheck = await this.checkDatabaseHealth();
    actions.push({
      action: 'database_health_check',
      result: dbCheck,
      timestamp: new Date().toISOString()
    });
    
    if (!dbCheck.healthy) {
      // Check if it's a connection pool issue
      if (dbCheck.error.includes('connection')) {
        const poolReset = await this.resetConnectionPool();
        actions.push({
          action: 'reset_connection_pool',
          result: poolReset,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check disk space
      const diskCheck = await this.checkDiskSpace();
      actions.push({
        action: 'disk_space_check',
        result: diskCheck,
        timestamp: new Date().toISOString()
      });
      
      if (diskCheck.usage > 90) {
        // Clean up old data
        const cleanup = await this.emergencyCleanup();
        actions.push({
          action: 'emergency_cleanup',
          result: cleanup,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return actions;
  }

  async handleSecurityBreach(incident) {
    const actions = [];
    
    // Immediate containment
    const containment = await this.containSecurityBreach(incident);
    actions.push({
      action: 'security_containment',
      result: containment,
      timestamp: new Date().toISOString()
    });
    
    // Collect evidence
    const evidence = await this.collectSecurityEvidence(incident);
    actions.push({
      action: 'collect_evidence',
      result: evidence,
      timestamp: new Date().toISOString()
    });
    
    // Notify security team
    await this.notifySecurityTeam(incident, evidence);
    actions.push({
      action: 'notify_security_team',
      timestamp: new Date().toISOString()
    });
    
    return actions;
  }

  async checkServiceHealth() {
    try {
      const { stdout } = await execAsync('curl -f http://localhost:3000/health');
      const health = JSON.parse(stdout);
      return { healthy: health.status === 'healthy', details: health };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async restartService() {
    try {
      await execAsync('pm2 restart jomobit-api');
      return { success: true, message: 'Service restarted successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async analyzeErrors() {
    // This would integrate with your logging system
    // For now, return mock analysis
    return {
      totalErrors: 150,
      errorRate: 8.5,
      topErrorEndpoint: '/api/posters/generate',
      topErrorType: 'TimeoutError',
      suggestScaling: true
    };
  }

  async sendAlert(incident, response) {
    const message = {
      title: `🚨 Incident Alert: ${incident.title}`,
      severity: incident.severity,
      description: incident.description,
      incidentId: response.incidentId,
      timestamp: response.timestamp,
      actions: response.actions.length
    };
    
    // Send to Slack
    if (this.alertChannels.slack) {
      try {
        const fetch = require('node-fetch');
        await fetch(this.alertChannels.slack, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${message.title}\n\nSeverity: ${message.severity}\nDescription: ${message.description}\nIncident ID: ${message.incidentId}\nActions Taken: ${message.actions}`
          })
        });
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }
  }

  async logIncident(incident, response) {
    const logEntry = {
      ...incident,
      ...response,
      loggedAt: new Date().toISOString()
    };
    
    // Log to file
    const fs = require('fs');
    fs.appendFileSync('/var/log/incidents.log', JSON.stringify(logEntry) + '\n');
    
    // Log to database if available
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.collection('incidents').insertOne(logEntry);
      }
    } catch (error) {
      console.error('Failed to log incident to database:', error);
    }
  }

  generateIncidentId() {
    return `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = IncidentResponse;
```

### Monitoring and Alerting

```bash
#!/bin/bash
# scripts/monitoring-setup.sh

set -e

echo "Setting up monitoring and alerting..."

# Install monitoring tools
apt update
apt install -y prometheus node-exporter grafana

# Configure Prometheus
cat > /etc/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "/etc/prometheus/rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'jomobit-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'mongodb'
    static_configs:
      - targets: ['localhost:9216']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
EOF

# Create alerting rules
mkdir -p /etc/prometheus/rules
cat > /etc/prometheus/rules/jomobit.yml << EOF
groups:
  - name: jomobit-api
    rules:
      - alert: APIDown
        expr: up{job="jomobit-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Jomobit API is down"
          description: "The Jomobit API has been down for more than 1 minute."

      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second."

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: medium
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }} seconds."

      - alert: DatabaseConnectionIssues
        expr: mongodb_up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection issues"
          description: "Cannot connect to MongoDB."

      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        labels:
          severity: high
        annotations:
          summary: "Redis is down"
          description: "Redis server is not responding."

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: medium
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%."

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: medium
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is above 80% for more than 10 minutes."

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Low disk space"
          description: "Disk space is below 10%."
EOF

# Start services
systemctl enable prometheus
systemctl start prometheus
systemctl enable node-exporter
systemctl start node-exporter
systemctl enable grafana-server
systemctl start grafana-server

echo "Monitoring setup completed!"
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3000 (admin/admin)"
```

This completes Chapter 9: Deployment & Operations. The documentation now covers all aspects of deploying and operating the Jomobit backend API in production, including deployment strategies, monitoring, scaling, maintenance, and incident response procedures.

Would you like me to proceed with creating Chapter 10: Troubleshooting to complete the documentation set?