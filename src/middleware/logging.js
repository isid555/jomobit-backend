const morgan = require('morgan');
const logger = require('../utils/logger');

// Create a stream object with a 'write' function that will be used by `morgan`
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Skip all the Morgan http log if the application is not running in development mode
const skip = () => {
  const env = process.env.NODE_ENV || 'development';
  return env !== 'development';
};

// Build the morgan middleware
const morganMiddleware = morgan(
  // Define message format string (this is the default one)
  ':method :url :status :res[content-length] - :response-time ms',
  // Options: in this case, I override the stream and the skip logic
  { stream, skip }
);

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request details
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.sub
  });

  // Override res.end to log response details
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.sub
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = {
  morganMiddleware,
  requestLogger
};