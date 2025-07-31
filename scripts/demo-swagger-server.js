#!/usr/bin/env node

/**
 * Demo server to showcase enhanced Swagger UI configuration
 * This server runs without database dependencies for testing purposes
 */

const express = require('express');
const { setupSwagger } = require('../src/config/swagger');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup enhanced Swagger documentation
setupSwagger(app);

// Basic health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'demo',
    message: 'Demo server for Swagger UI testing'
  });
});

// Mock API endpoints for demonstration
app.get('/api/demo/users', (req, res) => {
  res.json({
    users: [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
    ],
    total: 2
  });
});

app.post('/api/demo/users', (req, res) => {
  res.status(201).json({
    id: '3',
    name: req.body.name || 'New User',
    email: req.body.email || 'user@example.com',
    created: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Demo Swagger server running on port ${PORT}`);
  console.log(`📚 Enhanced Swagger UI available at: http://localhost:${PORT}/api-docs`);
  console.log(`🧪 Test utilities available at: http://localhost:${PORT}/api-docs/test-utils`);
  console.log(`📊 API status available at: http://localhost:${PORT}/api-docs/status`);
  console.log(`🔧 Troubleshooting guide at: http://localhost:${PORT}/api-docs/troubleshooting`);
  console.log(`💚 Health check at: http://localhost:${PORT}/health`);
  console.log('');
  console.log('🎯 Key Features Demonstrated:');
  console.log('  ✅ Enhanced UI with custom styling');
  console.log('  ✅ Persistent authentication');
  console.log('  ✅ Comprehensive testing utilities');
  console.log('  ✅ Detailed troubleshooting guide');
  console.log('  ✅ Organized endpoint grouping');
  console.log('  ✅ Interactive testing capabilities');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;