const mongoose = require('mongoose');

// Increase timeout for database operations
jest.setTimeout(30000);

// Setup before each test file
beforeAll(async () => {
  // Connect to MongoDB Memory Server
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(global.__MONGO_URI__, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Cleanup after all tests in a file
afterAll(async () => {
  // Close mongoose connection for this test file
  // Note: Global teardown will handle the final cleanup
});