const mongoose = require('mongoose');

module.exports = async () => {
  // Close mongoose connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  // Stop MongoDB Memory Server
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
  
  console.log('MongoDB Memory Server stopped');
};